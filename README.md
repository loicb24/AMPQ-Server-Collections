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