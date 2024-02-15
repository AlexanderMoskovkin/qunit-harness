const https = require('https');

export function httpsRequest (options, body) {
    return new Promise((resolve, reject) => {
        const request = https.request(options, response => {
            var data = '';

            response.on('data', chunk => {
                data += chunk.toString('utf8');
            });

            response.on('end', () => {
                const { statusCode, statusMessage } = response;

                if (statusCode >= 200 && statusCode <= 299)
                    resolve({ body: data, statusCode });
                else
                    reject({ statusCode, statusMessage });
            });

            response.on('error', reject);
        });

        if (options.method === 'PUT' && body) 
            request.write(body);

        request.on('error', reject);
        request.end();
    });
}
