/* eslint-disable no-undef */

var plugin;

function log(msg) {
  Zotero.debug('[__addonName__] ' + msg);
}

function install() {
  log('Installed plugin');
  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/__addonRef__.js`,
  );
  log(__addonInstance__);
  __addonInstance__.migratePrefs();
}

async function startup({ id, version, rootURI }) {
  log('Starting plugin');

  // register chrome
  var aomStartup = Components.classes[
    '@mozilla.org/addons/addon-manager-startup;1'
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + 'manifest.json');
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ['content', '__addonRef__', rootURI + 'content/'],
  ]);

  Zotero.PreferencePanes.register({
    pluginID: '__addonID__',
    src: rootURI + 'preferences.xhtml',
    scripts: [rootURI + 'preferences.js'],
  });

  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/__addonRef__.js`,
  );
  plugin = new __addonInstance__.Plugin({ id, version, rootURI });
  await plugin.startup();
}

function onMainWindowLoad({ window }) {
  plugin?.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  plugin?.removeFromWindow(window);
}

function shutdown() {
  log('Shutting down plugin');
  plugin?.shutdown();
  plugin = undefined;
}

function uninstall() {
  log('Uninstalled plugin');
}
