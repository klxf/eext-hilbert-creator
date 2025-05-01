"use strict";
var edaEsbuildExportName = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
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
    openCounter1Iframe: () => openCounter1Iframe,
    openIframe: () => openIframe
  });

  // extension.json
  var displayName = "Hilbert Creator";
  var description = "Hilbert Creator - \u5E0C\u5C14\u4F2F\u7279\u66F2\u7EBF\u751F\u6210\u5668";
  var version = "1.3.1";

  // src/index.ts
  function activate(status, arg) {
  }
  function about() {
    eda.sys_Dialog.showInformationMessage(
      displayName + " " + version + "\n" + description + "\n Github: https://github.com/klxf/eext-hilbert-creator",
      "\u5173\u4E8E"
    );
  }
  function openIframe() {
    eda.sys_IFrame.openIFrame("/iframe/index.html", 300, 345);
  }
  function openCounter1Iframe() {
    eda.sys_IFrame.openIFrame("/iframe/counter_1.html", 340, 300);
  }
  return __toCommonJS(src_exports);
})();
