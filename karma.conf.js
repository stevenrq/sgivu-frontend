process.env.CHROME_BIN = require("puppeteer").executablePath();

module.exports = function (config) {
  config.set({
    basePath: "",
    frameworks: ["jasmine", "@angular-devkit/build-angular"],
    plugins: [
      require("karma-jasmine"),
      require("karma-chrome-launcher"),
      require("karma-jasmine-html-reporter"),
      require("karma-coverage"),
      require("@angular-devkit/build-angular/plugins/karma"),
    ],

    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: "Chrome",
        flags: [
          "--headless",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--remote-debugging-port=9222",
        ],
      },
    },

    browsers: ["ChromeHeadlessNoSandbox"],

    singleRun: false,
    restartOnFileChange: true,
  });
};
