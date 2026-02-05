const logger = {
  error: (message: string, error: Error) => {
    console.error(message, error);
  },
  info: (message: string) => {
    console.log(message);
  },
  warn: (message: string) => {
    console.warn(message);
  },
};

export default logger;
