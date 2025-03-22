"use strict";
var edaEsbuildExportName = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name2 in all)
      __defProp(target, name2, { get: all[name2], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    about: () => about,
    activate: () => activate,
    openIframe: () => openIframe
  });

  // extension.json
  var name = "eext-hilbert-creator";
  var description = "Hilbert Creator - \u5E0C\u5C14\u4F2F\u7279\u66F2\u7EBF\u751F\u6210\u5668";
  var version = "1.2.3";

  // src/index.ts
  function activate(status, arg) {
  }
  function about() {
    eda.sys_MessageBox.showInformationMessage(name + " " + version + "\n" + description, "\u5173\u4E8E");
  }
  function openIframe() {
    eda.sys_IFrame.openIFrame("/iframe/index.html", 300, 600);
  }
  return __toCommonJS(src_exports);
})();
