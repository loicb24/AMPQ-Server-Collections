
import dotenv from 'dotenv';
import ampq from 'amqplib/callback_api';
import { v4 as uuidv4 } from "uuid";


export class AMPQExpress {

    defaultAddress: string;
    ampqConnection: ampq.Connection | undefined;

    constructor() {

        dotenv.config();
        this.defaultAddress = process.env.AMPQHOST || "amqp://localhost";

    }

    async connect() {

        this.ampqConnection = await new Promise((resolve, reject) => {

            ampq.connect(
                this.defaultAddress,
                (error1, connection) => {

                    if (error1) {
                        throw new Error(error1);
                    }

                    resolve(connection);
                }
            );
        });

    }

}

export class AMPRequest {

    static generateUUID() {
        return uuidv4();
    }

    static isNotComplientWithSchema(input: any, schema: string[]) {

        let missingProps = [];

        if (typeof input === 'string') {
            input = JSON.parse(input);
        }

        for (let prop of schema) {

            if (input.hasOwnProperty(prop))
                continue;

            missingProps.push(prop);
        }

        if (missingProps.length > 0) {
            return missingProps.join(', ')
        }

        return false;

    }

}


export class AMPQPushSub extends AMPRequest {

    static async publish(connection: ampq.Connection, exchange: string, message: any, callback: any, schema: string[] = []) {

        connection.createChannel(async (error, channel) => {

            if (typeof message === "object") {
                message = JSON.stringify(message);
            }

            console.log(` [🐇] Publisher for '${exchange}' created`);

            if (error) {
                throw error;
            }

            channel.assertExchange(exchange, 'fanout', {
                durable: true
            });

            channel.publish(exchange, '', Buffer.from(message));
            console.log(` [🐰] Message published to : ${exchange}`);

            await callback()

        });

    }

    static async subscribe(connection: ampq.Connection, exchange: string, callback: any, schema: string[] = []) {

        connection.createChannel(async (error, channel) => {

            if (error) {
                throw error;
            } 

            let queue = `${exchange}|${process.env.SERVICE_NAME || process.env.PORT}`
            channel.assertExchange(exchange, 'fanout', { durable: true });
            channel.prefetch(1);

            channel.assertQueue(queue, { exclusive: false, durable : true }, async (error2, q) => {

                if (error2) {
                    throw error2;
                }

                console.log(` [🐇] Waiting for message on '${exchange}'`);

                channel.bindQueue(q.queue, exchange, '');

                channel.consume(q.queue, async (msg: any) => {

                    let messageContent = msg?.content || "";

                    if (messageContent === "") {
                        // @todo : should be logged
                        return;
                    }

                    messageContent = messageContent.toString();

                    if (AMPQRpc.isNotComplientWithSchema(messageContent, schema)) {
                        // @todo : should be logged
                        return;
                    }

                    try {
                        messageContent = JSON.parse(messageContent)
                    } catch (e) {
                        // do nothing
                    }

                    await callback(messageContent);
                    
                }, {
                    noAck: true
                });
            });

        });

    }

}

export class AMPQRpc extends AMPRequest {

    static async on(connection: ampq.Connection, queue: string, callback: any, schema: string[] = []) {

        connection.createChannel(async (error, channel) => {

            if (error) {
                throw error;
            }

            var queue = 'UPSERT_USER';

            channel.assertQueue(queue, { durable: false });
            channel.prefetch(1);

            console.log(` [🐇] Awaiting RPC requests for queue ${queue}`);

            channel.consume(queue, async (msg) => {


                console.log(` [🐰] Got new message on queue : ${queue}`);

                let messageContent = msg?.content || "";

                if (messageContent === "") {
                    // @todo : should be logged
                    return;
                }

                messageContent = messageContent.toString();
                if (AMPQRpc.isNotComplientWithSchema(messageContent, schema)) {
                    channel.sendToQueue(msg?.properties.replyTo,
                        Buffer.from(JSON.stringify({
                            "Error": "The message is not complient with the schema",
                            "expected": AMPQRpc.isNotComplientWithSchema(messageContent, schema)
                        })), {
                        correlationId: msg?.properties.correlationId
                    });
                    return;
                }

                try {
                    messageContent = JSON.parse(messageContent)
                } catch (e) {
                    // do nothing
                }

                let reply = await callback(messageContent);
                if (typeof reply == 'object') {
                    reply = JSON.stringify(reply)
                }

                console.log(reply)

                channel.sendToQueue(msg?.properties.replyTo,
                    Buffer.from(reply), {
                    correlationId: msg?.properties.correlationId
                });

                channel.ack(msg!);

            });

        });

    }

    static async emit(connection: ampq.Connection, queue: string, message: any, callbackRecived: any, schema: any = {}) {

        if (typeof message === "object") {
            message = JSON.stringify(message);
        }

        connection.createChannel(async (error, channel) => {

            if (error) {
                throw error;
            }

            channel.assertQueue('', { exclusive: true }, async (errorAssert, q) => {

                console.log(` [🐇] Requesting ${queue}`, message);

                let correlationId = AMPQRpc.generateUUID();

                channel.consume(q.queue, async (msg) => {

                    if (msg?.properties.correlationId == correlationId) {

                        console.log(` [🐰] Answer on ${queue}`, msg.content.toString());

                        let messageContent = msg.content.toString();
                        try {
                            messageContent = JSON.parse(messageContent)
                        } catch (e) {
                            // do nothing
                        }

                        await callbackRecived(messageContent);

                    }

                })

                channel.sendToQueue(queue,
                    Buffer.from(message), {
                    correlationId: correlationId,
                    replyTo: q.queue,
                });

            });

        });

    }

}

