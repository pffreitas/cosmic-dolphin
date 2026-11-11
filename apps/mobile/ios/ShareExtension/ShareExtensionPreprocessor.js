class ShareExtensionPreprocessor {
  run({ completionFunction }) {
    completionFunction({ baseURI: document.baseURI, title: document.title });
  }
}
var ExtensionPreprocessingJS = new ShareExtensionPreprocessor();
