# AMPQ-Server-Collections
A library inspired by Express to facilitate the use of AMPQ

## How to install

Just use it as a submodule of any projet. The code is using Typescript, you should have a compilation strategy in place. Not my problem.

##  How to use It

Register a new instance of AMPQExpress

    let ampqE = new AMPQExpress();
    ampqE.connect().then(() => {
        // your handler goes here
    });

Used in combination with Express, in a scenario where an API will call a message to be pushed on RabbitMQ, you can and you **SHOULD** work within the callback of the connect function. This ensure that the endpoint is only ready when the connection with RabbitMQ is established.

    const app: Express = express();

    let ampqE = new AMPQExpress();
    ampqE.connect().then(() => {
        app.get('/api/sendToMQ', async (req: Request, res: Response) => {

          // your handler goes here

        })
    });

You can create multiple types of handlers.


### RPC

You should use RPC when the system that *emits* the messsage needs to wait for the other service to provide a response. This is a closed loop where there can be only 1 system that *emits* and one system that *reacts* to it (2 system could emit the *same* message, but the answer will only go to the system that emits his message).

This looks more or less like this : 

![Alt text](https://www.rabbitmq.com/img/tutorials/python-six.png)

On the sending side : 

    AMPQRpc.emit(ampqE.ampqConnection!, 'YOUR QUEUE', 'MESSAGE', (response: any) => {

        // do something with the answer
        // you don't have to return anything
        
    })

An on the receiving end : 

    AMPQRpc.on(ampqE.ampqConnection!, 'YOUR_QUEUE', (msg : string) => {

        // do something with what is send.
        // return something to the sender
        
    });

### Push/Sub : with persistant queue

The push/sub implementation contains persistant queue; This means that the system that *publish* the message place it on an exchange and from that exchange, each service that wants to consume the message implement it's own queue.

This looks more or less like this : 

![Alt text](https://www.rabbitmq.com/img/tutorials/python-three-overall.png)


On the subscriber side :

*(remember that you will **not** return anything to the service pushing !)*

    AMPQPushSub.subscribe(ampqE.ampqConnection!, 'YOUR_EXCHANGE', async (msg : any) => {

        // your code goes here
        // you don't have to return anything
        
    });

On the publisher side :

*(remember that you will **not** receive the answer to your message !)*

    const message = {hello : "world"};
    AMPQPushSub.publish(ampqE.ampqConnection!, 'YOUR_EXCHANGE', message, () => {

        // you can define a callback after sending
        // you don't have to return anything
    });

