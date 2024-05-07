import { Injectable } from '@nestjs/common';
import { ControllersService } from 'src/code-gen/controllers/controllers.service';
import { DtosService } from 'src/code-gen/dtos/dtos.service';
import { EntitiesService } from 'src/code-gen/entities/entities.service';
import { ModulesService } from 'src/code-gen/modules/modules.service';
import { ServicesService } from 'src/code-gen/services/services.service';
import * as JSZip from 'jszip';
import * as fs from 'fs';
import { promisify } from 'util';
import { BootstrapService } from 'src/code-gen/bootstrap/bootstrap.service';

const writeFileAsync = promisify(fs.writeFile);

@Injectable()
export class FileIoService {
  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly dtosService: DtosService,
    private readonly controllersService: ControllersService,
    private readonly servicesService: ServicesService,
    private readonly modulesService: ModulesService,
    private readonly bootstrapService: BootstrapService,
  ) {}

  async getProject(id: string) {
    const [entites, projectData] = await this.entitiesService.generateAllEntities(id);
    const entityNamesList = Object.keys(entites).slice(1);

    const dtos = await this.dtosService.generateAllDTOsByProject(
      entites['projectModels'],
    );
    const controllers =
      this.controllersService.generateControllers(entityNamesList);
    const services = this.servicesService.generateServices(entityNamesList);
    const modules = this.modulesService.generateModules(entityNamesList);
    const appModule = this.bootstrapService.generateAppModule(entityNamesList);
    const bootstrap = this.bootstrapService.getMainBootstrap();
    const packageJson = this.bootstrapService.generatePackageJson(projectData.projectName, projectData.projectDescription);
    const tsconfig = this.bootstrapService.generateTsConfig();
    

    const project = {
      ...projectData,
      entities: entites,
      dtos: dtos,
      controllers: controllers,
      services: services,
      modules: modules,
    };
    const project_name = projectData.projectName.toLowerCase();

    console.log('project: ', project);

    // Create a new zip file
    const zip = new JSZip();

    // Add files to the zip
    // for entities
    for (const [key, value] of Object.entries(entites)) {
      if (key === 'projectModels') {
        continue;
      }
      zip.file(`${project_name}/src/entities/${key}.entity.ts`, value as string);
    }
    // for dtos
    for (const [key, value] of Object.entries(dtos)) {
      zip.file(`${project_name}/src/dtos/${key}.dto.ts`, value as string);
    }
    // for controllers
    for (const [key, value] of Object.entries(controllers)) {
      zip.file(`${project_name}/src/${key}/controllers/${key}.controller.ts`, value as string);
    }
    // for services
    for (const [key, value] of Object.entries(services)) {
      zip.file(`${project_name}/src/${key}/services/${key}.service.ts`, value as string);
    }
    // for modules
    for (const [key, value] of Object.entries(modules)) {
      zip.file(`${project_name}/src/${key}/${key}.module.ts`, value as string);
    }
    // for bootstrap
    zip.file(`${project_name}/src/app.module.ts`, appModule as string);
    zip.file(`${project_name}/src/main.ts`, bootstrap as string);
    zip.file(`${project_name}/package.json`, packageJson as string);
    zip.file(`${project_name}/tsconfig.json`, tsconfig as string);

    // Generate zip content
    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

    // Save the zip file
    const zipFilePath = `src/file-io/output/${project_name}.zip`;
    await writeFileAsync(zipFilePath, zipContent);

    return { path: zipFilePath, project };
  }

  toKebabCase(text: string): string {
    let kebabCaseText = text.replace(/\s+/g, '-');
    
    kebabCaseText = kebabCaseText.toLowerCase();
    return kebabCaseText;
  }

  
}
