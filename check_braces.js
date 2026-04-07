const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\HP\\.gemini\\antigravity\\scratch\\visiting-card-scanner\\app.js', 'utf8');

let open = 0;
let lineNum = 1;
for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') open++;
    if (content[i] === '}') open--;
    if (content[i] === '\n') lineNum++;
    
    if (open < 0) {
        console.log(`Unmatched closing brace at line ${lineNum}`);
        open = 0; // Reset to continue
    }
}
console.log(`Final open count: ${open}`);
