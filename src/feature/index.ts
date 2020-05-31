/**
 * Kairat Bakytov
 * kainisoft@gmail.com
 */

import {normalize, Path, strings} from '@angular-devkit/core';
import {apply, applyTemplates, chain, mergeWith, move, Rule, SchematicsException, Tree, url} from '@angular-devkit/schematics';
import {addRouteDeclarationToModule} from '@schematics/angular/utility/ast-utils';
import {InsertChange} from '@schematics/angular/utility/change';
import {findModuleFromOptions, MODULE_EXT, ROUTING_MODULE_EXT} from '@schematics/angular/utility/find-module';
import {parseName} from '@schematics/angular/utility/parse-name';
import {createDefaultPath} from '@schematics/angular/utility/workspace';
import {Schema} from './schema';
import * as ts from 'typescript';

function addRouteDeclarationToNgModule(options: Schema, routingModulePath: Path | undefined): Rule {
  return (host: Tree) => {
    const path = routingModulePath || options.module as string;
    const text = host.read(path);

    if (!text) {
      throw new Error(`Couldn't find the module nor its routing module.`);
    }

    const sourceText = text.toString();
    const addDeclaration = addRouteDeclarationToModule(
      ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true),
      path,
      `{path: '${strings.dasherize(options.name)}', loadChildren: () => import('./features/${strings.dasherize(options.name)}/${strings.dasherize(options.name)}.module').then(m => m.${strings.classify(options.name)}Module)}`,
    ) as InsertChange;

    const recorder = host.beginUpdate(path);
    recorder.insertLeft(addDeclaration.pos, addDeclaration.toAdd);
    host.commitUpdate(recorder);

    return host;
  };
}

function getRoutingModulePath(host: Tree, modulePath: string): Path | undefined {
  const routingModulePath = modulePath.endsWith(ROUTING_MODULE_EXT)
    ? modulePath
    : modulePath.replace(MODULE_EXT, ROUTING_MODULE_EXT);

  return host.exists(routingModulePath) ? normalize(routingModulePath) : undefined;
}

export default function(options: Schema): Rule {
  return async (host: Tree) => {
    const workspaceConfigBuffer = host.read('angular.json');

    if (!workspaceConfigBuffer) {
      throw new SchematicsException('Not an Angular CLI workspace');
    }

    options.path = await createDefaultPath(host, JSON.parse(workspaceConfigBuffer.toString()).defaultProject);
    options.module = findModuleFromOptions(host, options);

    const parsedPath = parseName(options.path, options.name);

    options.name = parsedPath.name;
    options.path = parsedPath.name;

    const sourceParametrizedTemplates = apply(url('./files'), [
      applyTemplates({
        ...options,
        ...strings
      }),
      move(parsedPath.path)
    ]);

    return chain([
      addRouteDeclarationToNgModule(options, getRoutingModulePath(host, options.module as string)),
      mergeWith(sourceParametrizedTemplates)
    ]);
  };
}
