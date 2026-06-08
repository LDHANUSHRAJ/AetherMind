import fs from 'fs';

const code = fs.readFileSync('claude_ui/script.js', 'utf8');

let line = 1;
let col = 1;
const stack = [];

for (let i = 0; i < code.length; i++) {
    const char = code[i];
    if (char === '\n') {
        line++;
        col = 1;
    } else {
        col++;
    }

    // Skip string literals (simple heuristic)
    if (char === '"' || char === "'" || char === '`') {
        const quote = char;
        i++;
        while (i < code.length && code[i] !== quote) {
            if (code[i] === '\\') i++; // skip escaped
            if (code[i] === '\n') line++;
            i++;
        }
        continue;
    }

    // Skip comments
    if (char === '/' && code[i + 1] === '/') {
        while (i < code.length && code[i] !== '\n') i++;
        line++;
        col = 1;
        continue;
    }
    if (char === '/' && code[i + 1] === '*') {
        i += 2;
        while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
            if (code[i] === '\n') line++;
            i++;
        }
        i++;
        continue;
    }

    if (char === '{' || char === '(' || char === '[') {
        stack.push({ char, line, col });
    } else if (char === '}' || char === ')' || char === ']') {
        if (stack.length === 0) {
            console.log(`Unmatched closing character '${char}' at line ${line}, col ${col}`);
            process.exit(1);
        }
        const last = stack.pop();
        if (
            (char === '}' && last.char !== '{') ||
            (char === ')' && last.char !== '(') ||
            (char === ']' && last.char !== '[')
        ) {
            console.log(`Mismatched closing character '${char}' at line ${line}, col ${col} matching '${last.char}' from line ${last.line}, col ${last.col}`);
            process.exit(1);
        }
    }
}

if (stack.length > 0) {
    console.log(`Unclosed characters left at end of file:`);
    stack.forEach(item => {
        console.log(`- '${item.char}' opened at line ${item.line}, col ${item.col}`);
    });
} else {
    console.log('No mismatched brackets found by simple parser.');
}
