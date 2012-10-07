/*global Handlebars*/

/**
 * BaseView abstract class.
 */
define([
    'dejavu/AbstractClass',
    './Joint',
    './Controller',
    'services/state',
    'base-adapter/dom/Element',
    'dom-responder/DomResponder',
    'amd-utils/lang/isFunction',
    'amd-utils/lang/isString',
    'dejavu/common/isPlainObject'
], function (AbstractClass, Joint, Controller, stateRegistry, Element, DomResponder, isFunction, isString, isPlainObject) {

    'use strict';

    var BaseView = AbstractClass.declare({
        $name: 'BaseView',
        $extends: Joint,

        _element: null,
        _nativeElement: null,
        _dom: null,
        _events: null,

        /**
         * Constructor.
         *
         * @param {Element} [$element] The DOM element for the view, defaults to document.body
         */
        initialize: function ($element) {
            var key,
                func;

            // Assume the $element or create one based on the _element property
            this._element = $element ? $element : Element.createFrom(this._element || 'div');
            this._nativeElement = Element.getNativeElement(this._element);

            // Initialize the dom responder
            this._dom = new DomResponder(this._element);

            // Process the _events object if any
            if (this._events) {
                for (key in this._events) {
                    func = this._events[key];
                    if (isString(func)) {
                        func = this[func];
                        if (!isFunction(func)) {
                            throw new Error('Event handler for "' + key + '" references an unknown function.');
                        }
                    }

                    this._dom.on(key, func, this);
                }
            }

            this.$super();
        },

        /**
         * Returns the view's element.
         *
         * @return {Element} The view's element
         */
        getElement: function () {
            return this._element;
        },

        /**
         * Convenience method to append the element's view to a target.
         * The target can be another view, a DOM element or a CSS selector.
         *
         * @param {Element|String|BaseView} target The target
         *
         * @return {BaseView} The instance itself to allow chaining
         */
        appendTo: function (target) {
            if (target) {
                if (target instanceof BaseView) {
                    target = target._element;
                } else if (isString(target)) {
                    target = Element.findOne(target);
                }

                Element.append(target, this._element);
            }

            return this;
        },

        /**
         * Listen to the declared DOM events.
         * Make the view listen to the declared DOM events, and also manage its descedants uplinked DOM events.
         *
         * @return {BaseView} The instance itself to allow chaining
         */
        listen: function () {
            this._dom.listen();

            return this;
        },

        /**
         * Stop listening to DOM events.
         *
         * @return {BaseView} The instance itself to allow chaining
         */
        unlisten: function () {
            this._dom.unlisten();

            return this;
        },

        ////////////////////////////////////////////////////////////

        /**
         * {@inheritDoc}
         */
        _link: function (view) {
            if (!(view instanceof BaseView)) {
                throw new Error('Views can only link other views.');
            }

            this._dom.addChild(view._dom);

            return this.$super(view);
        },

        /**
         * {@inheritDoc}
         */
        _unlink: function (view) {
            if (view instanceof BaseView) {
                this._dom.removeChild(view._dom);
                this.$super(view);
            }

            return this;
        },

        /**
         * Checks if this view is the root view of a module or if it has been explicitly told to listen to DOM events.
         *
         * @return {Boolean} True if it is the root view, false otherwise
         */
        _isRoot: function () {
            var x;

            // Check if it has been told to be listening
            if (this._dom.isListening()) {
                return true;
            }

            // Check if this view is the root view of the module
            for (x = this._uplinks.length - 1; x >= 0; x -= 1) {
                if (this._uplinks[x] instanceof BaseView) {
                    return false;
                }
            }

            return true;
        },

        /**
         * Generates an URL.
         *
         * @param {String} state     The state name
         * @param {Object} [$params] The state params
         *
         * @return {String} The generated URL
         */
        _generateUrl: function (state, $params) {
            var controller = this._getController();

            if (!controller) {
                throw new Error('Could not find the controller responsible for "' + this.$name + '".');
            }

            return controller.generateUrl(state, $params);
        },

        /**
         * Get the controller responsible for the view.
         * The view will be interpreted as the function context, so call this function with .call(view).
         *
         * @return {Controller} The view's controller
         */
        _getController: function () {
            var curr,
                x,
                length,
                ret,
                tmp;

            // Find the view's controller
            curr = this;
            while ((length = curr._uplinks.length)) {
                for (x = length - 1; x >= 0; x -= 1) {
                    tmp = curr._uplinks[x];
                    if (tmp instanceof Controller) {
                        return tmp;
                    } else if (tmp instanceof BaseView) {
                        ret = tmp._getController();
                        if (ret) {
                            return ret;
                        }
                    }
                }
            }

            return null;
        },

        /**
         * Fills an object with helpers to be used in the templates.
         *
         * @param {Object} obj The object to be filled
         *
         * @return {Object} The same object with the filled helpers
         */
        _fillHelpers: function (obj) {
            if (!isPlainObject(obj)) {
                throw new Error('Expected a plain object to be passed to the template.');
            }

            obj.$url = function (state, $params) {
                return this._generateUrl(state, $params);
            }.$bind(this);

            obj.$view = this;

            if (window.Handlebars && !this.$self._injectedHandlebarsHelpers) {
                Handlebars.registerHelper('url', function (state, params) {
                    return this.$view._generateUrl(state, params.hash);
                });
                this.$self._injectedHandlebarsHelpers = true;
            }

            return obj;
        },

        /**
         * {@inheritDoc}
         */
        _onDestroy: function () {
            this.$super();

            // Destroy responder
            this._dom.destroy();
            this._dom = null;

            // Destroy view element
            Element.remove(this._element);

            // Null references
            this._element = this._nativeElement = null;
        },

        ////////////////////////////////////////////////////////////

        $statics: {
            _injectedHandlebarsHelpers: false
        }
    });



    return BaseView;
});