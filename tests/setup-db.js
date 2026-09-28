// Runs before every test file (see "jest" -> "setupFiles" in package.json).
//
// database.js opens the SQLite file 'blog.db' relative to the current working
// directory. Without this setup the tests would write into the blog.db that is
// stored in the repository. Each test file is therefore moved into its own
// temporary directory, where database.js creates an empty database.
 
const fs = require('fs');
const os = require('os');
const path = require('path');
 
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-test-'));
process.chdir(tempDir);
 
