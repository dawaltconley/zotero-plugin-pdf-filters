/* eslint-disable */

window.__addonInstance___Preferences = {
  init: function () {
    Zotero.debug('__addonName__: Initialize preference pane');

    const contrast = document.getElementById('__addonRef___default-contrast');
    // checkbox.addEventListener('click', (e) => {
    //   Zotero.debug(
    //     'Focused Mode: toggled annotation pref: ' + checkbox.checked,
    //   );
    //   Zotero.Reader._readers.forEach((reader) => {
    //     const doc = reader?._iframeWindow?.document?.documentElement;
    //     if (!doc) return;
    //     doc.dataset.hideAnnotationBar = checkbox.checked;
    //   });
    // });
  },
};
