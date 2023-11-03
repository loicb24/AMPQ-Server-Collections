
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


export class AMPQRpc {

    static generateUUID() {

    }

    static on(connection: ampq.Connection, queue: string, callback: any) {

        connection.createChannel((error, channel) => {

            if (error) {
                throw error;
            }

            var queue = 'UPSERT_USER';

            channel.assertQueue(queue, { durable: false });
            channel.prefetch(1);

            console.log(` [🐇] Awaiting RPC requests for queue ${queue}`);

            channel.consume(queue, (msg) => {


                console.log(` [🐰] Got new message on queue : ${queue}`);

                let messageContent = msg?.content || "";

                if (messageContent === "") {
                    // @todo : should be logged
                    return;
                }

                messageContent = messageContent.toString();

                try {
                    messageContent = JSON.parse(messageContent)
                } catch (e) {
                    // do nothing
                }

                let reply = callback(messageContent);
                if (typeof reply == 'object') {
                    reply = JSON.stringify(reply)
                }

                channel.sendToQueue(msg?.properties.replyTo,
                    Buffer.from(reply), {
                    correlationId: msg?.properties.correlationId
                });

                channel.ack(msg!);

            });

        });

    }

    static async emit(connection: ampq.Connection, queue: string, message: any, callbackRecived: any) {

        await connection;

        if (typeof message === "object") {
            message = JSON.stringify(message);
        }

        connection.createChannel((error, channel) => {

            if (error) {
                throw error;
            }

            channel.assertQueue('', { exclusive: true }, (errorAssert, q) => {

                console.log(` [🐇] Requesting ${queue}`, message);

                let correlationId = uuidv4();

                channel.consume(q.queue, (msg) => {

                    if (msg?.properties.correlationId == correlationId) {

                        console.log(` [🐰] Answer on ${queue}`, msg.content.toString());

                        let messageContent = msg.content.toString();
                        try {
                            messageContent = JSON.parse(messageContent)
                        } catch (e) {
                            // do nothing
                        }

                        callbackRecived(messageContent);

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

