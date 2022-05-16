// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import regeneratorRuntime from 'regenerator-runtime';

import {Client4} from 'mattermost-redux/client';

import {Preferences} from 'mattermost-redux/constants';

import {getConfig, isPerformanceDebuggingEnabled} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import store from 'stores/redux_store.jsx';
import {ActionTypes} from 'utils/constants';
import {getSiteURL} from 'utils/url';
import PluginRegistry from 'plugins/registry';
import {unregisterAllPluginWebSocketEvents, unregisterPluginReconnectHandler} from 'actions/websocket_actions.jsx';
import {unregisterPluginTranslationsSource} from 'actions/views/root';
import {unregisterAdminConsolePlugin} from 'actions/admin_actions';
import {trackPluginInitialization} from 'actions/telemetry_actions';

import {removeWebappPlugin} from './actions';

// Including the fullscreen modal css to make it available to the plugins
// (without lazy loading). This should be removed in the future whenever we
// have all plugins migrated to common components that can be reused there.
import 'components/widgets/modals/full_screen_modal.scss';

// Plugins may have been compiled with the regenerator runtime. Ensure this remains available
// as a global export even though the webapp does not depend on same.
window.regeneratorRuntime = regeneratorRuntime;

// plugins records all active web app plugins by id.
window.plugins = {};

// registerPlugin, on the global window object, should be invoked by a plugin's web app bundle as
// it is loaded.
//
// During the beta, plugins manipulated the global window.plugins data structure directly. This
// remains possible, but is officially deprecated and may be removed in a future release.
function registerPlugin(id, plugin) {
    console.log('FEDS registering', id, plugin);
    const oldPlugin = window.plugins[id];
    if (oldPlugin && oldPlugin.uninitialize) {
        oldPlugin.uninitialize();
    }

    window.plugins[id] = plugin;
}
window.registerPlugin = registerPlugin;

function arePluginsEnabled(state) {
    if (getConfig(state).PluginsEnabled !== 'true') {
        return false;
    }

    if (
        isPerformanceDebuggingEnabled(state) &&
        getBool(state, Preferences.CATEGORY_PERFORMANCE_DEBUGGING, Preferences.NAME_DISABLE_CLIENT_PLUGINS)
    ) {
        return false;
    }

    return true;
}

// initializePlugins queries the server for all enabled plugins and loads each in turn.
export async function initializePlugins() {
    if (!arePluginsEnabled(store.getState())) {
        return;
    }

    const {data, error} = await getPlugins()(store.dispatch);
    if (error) {
        console.error(error); //eslint-disable-line no-console
        return;
    }

    if (data == null || data.length === 0) {
        return;
    }

    await Promise.all(data.map((m) => {
        return loadPlugin(m).catch((loadErr) => {
            console.error(loadErr.message); //eslint-disable-line no-console
        });
    }));

    trackPluginInitialization(data);
}

// getPlugins queries the server for all enabled plugins
export function getPlugins() {
    return async (dispatch) => {
        let plugins;
        try {
            plugins = await Client4.getWebappPlugins();
        } catch (error) {
            return {error};
        }

        dispatch({type: ActionTypes.RECEIVED_WEBAPP_PLUGINS, data: plugins});

        return {data: plugins};
    };
}

// loadedPlugins tracks which plugins have been added as script tags to the page
const loadedPlugins = {};

// describePlugin takes a manifest and spits out a string suitable for console.log messages.
const describePlugin = (manifest) => (
    'plugin ' + manifest.id + ', version ' + manifest.version
);

// loadPlugin fetches the web app bundle described by the given manifest, waits for the bundle to
// load, and then ensures the plugin has been initialized.
export function loadPlugin(manifest) {
    return new Promise((resolve, reject) => {
        if (!arePluginsEnabled(store.getState())) {
            return;
        }

        // Don't load it again if previously loaded
        const oldManifest = loadedPlugins[manifest.id];
        if (oldManifest && oldManifest.webapp.bundle_path === manifest.webapp.bundle_path) {
            resolve();
            return;
        }

        if (oldManifest) {
            // upgrading, perform cleanup
            store.dispatch(removeWebappPlugin(manifest));
        }

        async function onLoad() {
            console.log('FEDS onLoad 1');
            const scope = manifest.id;

            // Initializes the core app's sharing scope
            await __webpack_init_sharing__('default');
            console.log('FEDS onLoad 2');
            const container = window[scope];
            console.log('FEDS onLoad 3', container);

            await container.init(__webpack_share_scopes__.default);
            console.log('FEDS onLoad 4');

            // This loads the plugin using the module federation dealy
            const plugin = await window[scope].get('plugin');
            console.log('FEDS onLoad 5');
            await plugin();
            console.log('FEDS onLoad 6');

            initializePlugin(manifest);
            console.log('FEDS onLoad 7');
            console.log('Loaded ' + describePlugin(manifest)); //eslint-disable-line no-console
            resolve();
        }

        function onError() {
            reject(new Error('Unable to load bundle for ' + describePlugin(manifest)));
        }

        // Backwards compatibility for old plugins
        let bundlePath = manifest.webapp.bundle_path;
        if (bundlePath.includes('/static/') && !bundlePath.includes('/static/plugins/')) {
            bundlePath = bundlePath.replace('/static/', '/static/plugins/');
        }

        console.log('Loading ' + describePlugin(manifest)); //eslint-disable-line no-console

        const script = document.createElement('script');
        script.id = 'plugin_' + manifest.id;
        script.type = 'text/javascript';
        script.src = getSiteURL() + bundlePath;
        script.onload = onLoad;
        script.onerror = onError;

        document.getElementsByTagName('head')[0].appendChild(script);
        loadedPlugins[manifest.id] = manifest;
    });
}

// initializePlugin creates a registry specific to the plugin and invokes any initialize function
// on the registered plugin class.
function initializePlugin(manifest) {
    console.log('FEDS manifest', manifest);
    // // Initialize the plugin
    const plugin = window.plugins[manifest.id];
    console.log('FEDS plugin', plugin);
    const registry = new PluginRegistry(manifest.id);
    if (plugin && plugin.initialize) {
        plugin.initialize(registry, store);
    }
}

// removePlugin triggers any uninitialize callback on the registered plugin, unregisters any
// event handlers, and removes the plugin script from the DOM entirely. The plugin is responsible
// for removing any of its registered components.
export function removePlugin(manifest) {
    if (!loadedPlugins[manifest.id]) {
        return;
    }
    console.log('Removing ' + describePlugin(manifest)); //eslint-disable-line no-console

    delete loadedPlugins[manifest.id];

    store.dispatch(removeWebappPlugin(manifest));

    const plugin = window.plugins[manifest.id];
    if (plugin && plugin.uninitialize) {
        plugin.uninitialize();

    // Support the deprecated deinitialize callback from the plugins beta.
    } else if (plugin && plugin.deinitialize) {
        plugin.deinitialize();
    }
    unregisterAllPluginWebSocketEvents(manifest.id);
    unregisterPluginReconnectHandler(manifest.id);
    store.dispatch(unregisterAdminConsolePlugin(manifest.id));
    unregisterPluginTranslationsSource(manifest.id);
    const script = document.getElementById('plugin_' + manifest.id);
    if (!script) {
        return;
    }
    script.parentNode.removeChild(script);
    console.log('Removed ' + describePlugin(manifest)); //eslint-disable-line no-console
}

// loadPluginsIfNecessary synchronizes the current state of loaded plugins with that of the server,
// loading any newly added plugins and unloading any removed ones.
export async function loadPluginsIfNecessary() {
    if (!arePluginsEnabled(store.getState())) {
        return;
    }

    const oldManifests = store.getState().plugins.plugins;

    const {error} = await getPlugins()(store.dispatch);
    if (error) {
        console.error(error); //eslint-disable-line no-console
        return;
    }

    const newManifests = store.getState().plugins.plugins;

    // Get new plugins and update existing plugins if version changed
    Object.values(newManifests).forEach((newManifest) => {
        const oldManifest = oldManifests[newManifest.id];
        if (!oldManifest || oldManifest.version !== newManifest.version) {
            loadPlugin(newManifest).catch((loadErr) => {
                console.error(loadErr.message); //eslint-disable-line no-console
            });
        }
    });

    // Remove old plugins
    Object.keys(oldManifests).forEach((id) => {
        if (!newManifests.hasOwnProperty(id)) {
            const oldManifest = oldManifests[id];
            removePlugin(oldManifest);
        }
    });
}
