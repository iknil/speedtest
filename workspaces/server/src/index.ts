import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes } from 'crypto';
import path from 'path';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';

interface ServerConfig {
    getIPInfo?: (ip: string) => {org: string, country: string};
}

module.exports = function(config: ServerConfig) {
    let cache: Buffer;

    const fastify: FastifyInstance = Fastify({
        logger: true
    });

    fastify.get('/empty', async (request, reply) => {
        reply
            .code(200)
            .send('');
    });

    fastify.post('/empty', async (request, reply) => {
        reply
            .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            .header('Cache-Control', 'post-check=0, pre-check=0')
            .header('Pragma', 'no-cache')
            .code(200)
            .send('');
    });

    fastify.get('/garbage', async (request: FastifyRequest<{
        Querystring: {
            ckSize: number,
        };
    }>, reply) => {
        reply
            .header('Content-Description', 'File Transfer')
            .header('Content-Type', 'application/octet-stream')
            .header('Content-Disposition', 'attachment; filename=random.dat')
            .header('Content-Transfer-Encoding', 'binary')
            .header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            .header('Cache-Control', 'post-check=0, pre-check=0')
            .header('Pragma', 'no-cache')
        
            const requestedSize = (request.query.ckSize || 100);

            const send = () => {
                for (let i = 0; i < requestedSize; i++) {
                    reply.raw.write(cache);
                }
                reply.raw.end();
            };

            if (cache !== undefined) {
                send();
            } else {
                randomBytes(1048576, (_, bytes) => {
                    cache = bytes;
                    send();
                });
            }
    });

    fastify.get('/getIP', async (request, reply) => {
        let requestIP: string = request.headers['x-forwarded-for'] as string || 
            request.connection.remoteAddress || 
            request.headers['HTTP_CLIENT_IP'] as string || 
            request.headers['X-Real-IP'] as string || 
            request.headers['HTTP_X_FORWARDED_FOR'] as string || 
            '';
        if (requestIP.substr(0, 7) === "::ffff:") {
            requestIP = requestIP.substr(7)
        }

        if (config.getIPInfo) {
            const ipData = await config.getIPInfo(requestIP);
            const org = ipData.org;
            const country = ipData.country;
            reply
            .code(200)
            .send(`${requestIP} - ${org} - ${country}`);
        } else {
            reply
            .code(200)
            .send(`${requestIP}`);
        }
    });

    return async () => {
        // register
        await fastify.register(cors, {});
        await fastify.register(multipart);
        await fastify.register(fastifyStatic, {
            root: path.join(__dirname, '../public'),
        });

        try {
            await fastify.listen({ port: 50003 });
        } catch (err) {
            process.exit(1);
        }
    }
}