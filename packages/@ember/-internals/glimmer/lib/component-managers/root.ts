import { getFactoryFor } from '@ember/-internals/container';
import { Factory } from '@ember/-internals/owner';
import { _instrumentStart } from '@ember/instrumentation';
import { DEBUG } from '@glimmer/env';
import {
  ComponentDefinition,
  Environment,
  InternalComponentCapabilities,
  Option,
  Template,
  VMArguments,
} from '@glimmer/interfaces';
import { CONSTANT_TAG, consumeTag } from '@glimmer/validator';
import { DIRTY_TAG } from '../component';
import { DynamicScope } from '../renderer';
import ComponentStateBucket, { Component } from '../utils/curly-component-state-bucket';
import CurlyComponentManager, {
  initialRenderInstrumentDetails,
  processComponentInitializationAssertions,
} from './curly';
import DefinitionState from './definition-state';

class RootComponentManager extends CurlyComponentManager {
  component: Component;

  constructor(component: Component) {
    super();
    this.component = component;
  }

  getStaticLayout(): Template {
    return this.templateFor(this.component);
  }

  create(
    environment: Environment,
    _state: DefinitionState,
    _args: Option<VMArguments>,
    dynamicScope: DynamicScope
  ) {
    let component = this.component;

    let finalizer = _instrumentStart('render.component', initialRenderInstrumentDetails, component);

    dynamicScope.view = component;

    let hasWrappedElement = component.tagName !== '';

    // We usually do this in the `didCreateElement`, but that hook doesn't fire for tagless components
    if (!hasWrappedElement) {
      if (environment.isInteractive) {
        component.trigger('willRender');
      }

      component._transitionTo('hasElement');

      if (environment.isInteractive) {
        component.trigger('willInsertElement');
      }
    }

    if (DEBUG) {
      processComponentInitializationAssertions(component, {});
    }

    let bucket = new ComponentStateBucket(
      environment,
      component,
      null,
      CONSTANT_TAG,
      finalizer,
      hasWrappedElement
    );

    consumeTag(component[DIRTY_TAG]);

    return bucket;
  }
}

// ROOT is the top-level template it has nothing but one yield.
// it is supposed to have a dummy element
export const ROOT_CAPABILITIES: InternalComponentCapabilities = {
  dynamicLayout: false,
  dynamicTag: true,
  prepareArgs: false,
  createArgs: false,
  attributeHook: true,
  elementHook: true,
  createCaller: true,
  dynamicScope: true,
  updateHook: true,
  createInstance: true,
  wrapped: true,
  willDestroy: false,
};

export class RootComponentDefinition implements ComponentDefinition {
  state: DefinitionState;
  manager: RootComponentManager;

  constructor(public component: Component) {
    let manager = new RootComponentManager(component);
    this.manager = manager;
    let factory = getFactoryFor(component);
    this.state = {
      name: factory!.fullName.slice(10),
      capabilities: ROOT_CAPABILITIES,
      ComponentClass: factory as Factory<any, any>,
    };
  }
}
