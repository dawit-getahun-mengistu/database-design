import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelItem } from 'src/database/model/entities/model.entity';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { RelationItem } from 'src/database/relations/entities/relation.entity';
import { ColumnItem } from 'src/database/columns/entities/column.entity';
import { HandlebarsService } from 'src/handlebars.service';
import { ModelService } from 'src/database/model/model.service';

@Injectable()
export class EntitiesService {
  private readonly entityTemplate: string;
  private allModels: ModelItem[];

  constructor(
    private readonly modelService: ModelService,
    private readonly handlebarsService: HandlebarsService,

    // repositories
    @InjectRepository(ModelItem)
    private readonly modelItemRepository: Repository<ModelItem>,
    @InjectRepository(ColumnItem)
    private readonly columnItemRepository: Repository<ColumnItem>,
    @InjectRepository(RelationItem)
    private readonly relationItemRepository: Repository<RelationItem>,
  ) {
    // get template file
    this.entityTemplate = fs.readFileSync(
      'src/code-gen/entities/template/entity-template.hbs',
      'utf8',
    );

    // get all models
    this.setUpModels();
  }

  async setUpModels() {
    this.allModels = await this.modelService.findAll();
  }

  async generateByModelId(modelId: string) {
    let model = this.allModels.find((model) => model.id === modelId);
    if (!model) {
      this.setUpModels();
      model = this.allModels.find((model) => model.id === modelId);
      if (!model) {
        throw new NotFoundException(`Model with id ${modelId} not found`);
      }
      
    }

    const properties = model.columns
      .filter((column) => !column.isPrimaryKey && !column.isForeignKey)
      .map((column) => ({
        Name: column.name,
        Type: column.type,
        Nullable: column.isNullable,
        Unique: column.isUnique,
      }));

    const primaryKey = model.columns.find((column) => column.isPrimaryKey);

    const relationships = await Promise.all(
      model.columns
        .filter((column) => column.isForeignKey)
        .map(async (column) => {
          const relation = await this.relationItemRepository.findOne({
            where: {
              columnId: column.id,
            },
            relations: ['referencedColumn'],
          });
          const relatedEntity = this.allModels.find((model) =>
            model.columns.find((col) => col.id === relation.referencedColumnId),
          );
          return {
            ForeignKey: relation.referencedColumn.name,
            RelatedEntity:
              relatedEntity.modelName.charAt(0).toUpperCase() +
              relatedEntity.modelName.slice(1),
            RelatedEntityLower:
              relatedEntity.modelName.charAt(0).toLowerCase() +
              relatedEntity.modelName.slice(1),
            Name: relation.name,
            RelationshipType: relation.type,
            Type: column.type,
          };
        }),
    );
    console.log('relationships:', relationships);

    const table = {
      ClassName: model.modelName,
      ClassNameLower:
        model.modelName.charAt(0).toLowerCase() + model.modelName.slice(1),
      PrimaryKey: primaryKey.name,
      PrimaryKeyType: primaryKey.type,
      Properties: properties,
      Relationships: relationships,
    };

    return this.handlebarsService.compileTemplate(this.entityTemplate, table);
  }

  async generateAllEntities(projectId: string) {
    const projectModels = this.allModels.filter(
      (model) => model.project.id === projectId,
    );
    if (!projectModels.length) {
      this.setUpModels();
      return this.generateAllEntities(projectId);
    }

    const generatedEntities = await Promise.all(
      projectModels.map(async (model) => ({
        [model.modelName]: await this.generateByModelId(model.id),
      })),
    );

    return Object.assign(
      { projectModels: projectModels },
      ...generatedEntities,
    );
  }
}
