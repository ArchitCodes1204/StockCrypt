const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    console.log(`In-memory MongoDB started at ${uri}`);

    const env = { ...process.env, MONGO_URI: uri, PORT: '5001' };

    const server = spawn('node', ['server.js'], {
        env,
        stdio: 'inherit',
        cwd: __dirname
    });

    server.on('close', async (code) => {
        console.log(`Server exited with code ${code}`);
        await mongod.stop();
    });
})();
