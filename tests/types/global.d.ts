declare namespace NodeJS {
  interface Global {
    testUtils: {
      getConsoleOutput: () => string;
      getConsoleWarnings: () => string;
      getConsoleErrors: () => string;
    };
  }
} 