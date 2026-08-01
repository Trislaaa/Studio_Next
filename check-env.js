require('dotenv').config();
const url = process.env.DATABASE_URL || '';
console.log(`URL Length: ${url.length}`);
console.log(`Starts with: ${url.substring(0, 15)}...`);
console.log(`Contains space: ${url.includes(' ')}`);
console.log(`Contains quotes: ${url.includes('"') || url.includes("'")}`);
// Don't print the password part
const parts = url.split('@');
if (parts.length > 1) {
    console.log(`Host part: @${parts[1]}`);
} else {
    console.log('No @ found');
    console.log(`Full URL (masked): ${url}`);
}
