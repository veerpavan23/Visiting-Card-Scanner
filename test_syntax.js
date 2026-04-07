try {
    require('./app.js');
    console.log("Syntax OK");
} catch (e) {
    console.error("Syntax Error found!");
    console.error(e.stack);
}
