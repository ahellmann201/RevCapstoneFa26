export default {
    test: {
        environment: "jsdom",
        // Stream console messages even when tests pass.
        silent: false,
        disableConsoleIntercept: true,
        include: ["frontend/js/test/**/*.test.js"],
    },
};
