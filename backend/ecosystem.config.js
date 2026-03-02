module.exports = {
    apps: [
        {
            name: 'ocr-po-backend',
            script: 'server.js',
            cwd: '/var/www/ocr-po/backend',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production',
                PORT: 5001
                // Do NOT put secrets here. They are loasded from the .env file via dotenv in server.js
            },
            // Logging
            error_file: '/var/log/pm2/ocr-po-error.log',
            out_file: '/var/log/pm2/ocr-po-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        }
    ]
};
