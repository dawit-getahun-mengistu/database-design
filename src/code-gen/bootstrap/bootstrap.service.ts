import { Injectable } from '@nestjs/common';
import { HandlebarsService } from 'src/handlebars.service';
import * as fs from 'fs';

@Injectable()
export class BootstrapService {
  private readonly appModuleTemplate: string;
  private readonly mainBootstrapTemplate: string;

  constructor(private readonly handlebarsService: HandlebarsService) {
    this.appModuleTemplate = fs.readFileSync(
      'src/code-gen/bootstrap/templates/app-module-template.hbs',
      'utf-8',
    );
    this.mainBootstrapTemplate = fs.readFileSync(
      'src/code-gen/bootstrap/templates/main-template.txt',
      'utf-8',
    );
  }

  generateAppModule(entities: string[]) {
    const data = {
      Entities: entities,
    };
    const template = this.handlebarsService.compileTemplate(
      this.appModuleTemplate,
      data,
    );
    return template;
  }

  getMainBootstrap() {
    return this.mainBootstrapTemplate;
  }
}
