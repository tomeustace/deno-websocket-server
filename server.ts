import { WebSocketServer } from "https://deno.land/x/websocket@v0.1.3/mod.ts";
import { Application, Context, Router, ServerSentEventTarget } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

const WS_PORT = 8080;
const wss = new WebSocketServer(WS_PORT);

let eventClient: ServerSentEventTarget;

// we want to ensure there is a connectionId also
type WebSocketServerId = WebSocketServer & {connectionId: string};
// map of websocket connections
const connections = new Map<string, WebSocketServerId>();

wss.on("connection", function (ws: WebSocketServerId) {
    
   ws.on("message", async function (event) {
   const data = JSON.parse(event);
   // websocket clients must send a connectionId
   if (!data.connectionId) {
     throw new Error("No connectionId");
   }

   ws.connectionId = data.connectionId;

   // store the connection
   connections.set(ws.connectionId, ws);
   try {
      if (eventClient) {
        // dispatch message to EventSource client if exists
        eventClient?.dispatchMessage(data);
      }
    } catch(err) {
      console.log(err);
    }
    
  });
  
  ws.on("close", function () {
    // remove the connection from map
    connections.delete(ws.connectionId);
    const msg = JSON.stringify({ close: { connectionId: ws.connectionId } });
    // update client with close event
    if (eventClient) {
      eventClient.dispatchMessage(msg);
    }
  });
    
});

console.log("listening on port", WS_PORT );

const HTTP_PORT = 8082;
const app = new Application();
const router = new Router();

// provide an http endpoint for our EventSource client to connect on
const events = (context: Context) => {
  eventClient = context.sendEvents();
};
router.get("/events", events);

app.use(oakCors({origin: "*"}))
app.use(router.routes());
app.listen({ port: HTTP_PORT });