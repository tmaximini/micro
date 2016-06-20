const Koa = require('koa');
const Redis = require('ioredis');
const redis = new Redis();
const app = new Koa();
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser');
const uuid = require('node-uuid');

function errorLogger(error, next) {
  console.error('error', err);
  next(new Error(err));
}

async function responseTime(ctx, next) {
  const start = new Date();
  await next();
  const ms = new Date() - start;
  console.log('X-Response-Time ', `${ms}ms`);
  ctx.set('X-Response-Time', `${ms}ms`);
}

function logger(format) {
  format = format || ':method ":url"';

  return async function(ctx, next) {
    const str = format
      .replace(':method', ctx.method)
      .replace(':url', ctx.url)

    console.log(str);

    await next();
  };
}

async function errorHandler(ctx, next) {
  try {
    await next(); // next is now a function
  } catch (err) {
    console.log('an error occured', err.message);
    ctx.body = { message: err.message };
    ctx.status = err.status || 500;
  }
}

// middleware
app.use(responseTime);
app.use(errorHandler);
app.use(logger());
app.use(bodyParser());


// returns all messages for a uuid and deletes them afterwards
async function popAllMessagesForUser(clientId) {
  const messages = [];
  const length = await redis.llen(clientId);
  for (var i = length - 1; i >= 0; i--) {
    let msg = await redis.lpop(clientId);
    messages.push(JSON.parse(msg));
  }
  return messages;
}

// returns all messages without deleting them
async function getAllMessagesForUser(clientId, offset, limit) {
  return redis.lrange(clientId, offset, limit);
}

async function getMessageById(clientId, messageId, options) {
  const length = await redis.llen(clientId);
  for (var i = length - 1; i >= 0; i--) {
    const el = await redis.lrange(clientId, i, 1);
    const parsed = JSON.parse(el);
    console.log('parsed', parsed);
    if (parsed.messageId === messageId) {
      if (options && options.delete) {

      }
      return parsed;
    }
  }
  return null;
}


router
  // gets all messages
  .get('/clients/:clientId/messages', async (ctx, next) => {
    try {
      const offset = ctx.query.offset || 0;
      const limit = ctx.query.limit || -1;
      const result = await getAllMessagesForUser(ctx.params.clientId, offset, limit);
      const messages = JSON.parse(result);
      ctx.body = { messages };
    }
    catch (err) {
      errorLogger(err, next);
    }
  })
  // gets a single message
  .get('/clients/:clientId/messages/:messageId', async (ctx, next) => {
    try {
      const message = await getMessageById(ctx.params.clientId, ctx.params.messageId);
      ctx.status = 200;
      ctx.body = { message };
    }
    catch (err) {
      errorLogger(err, next);
    }
  })
  // creates a new message
  .post('/clients/:clientId/messages', (ctx, next) => {
    try {
      const body = ctx.request.body;
      // if no messageId is present, generate one
      body.messageId = body.messageId || uuid.v4();
      redis.lpush(ctx.params.clientId, JSON.stringify(body));
      ctx.status = 200;
    }
    catch (err) {
      errorLogger(err, next);
    }
  })
  // deletes all messages
  .del('/clients/:clientId/messages', (ctx, next) => {
    try {
      redis.del(ctx.params.clientId);
      ctx.status = 200;
    }
    catch (err) {
      errorLogger(err, next);
    }
  })
  // deletes a single message
  .del('/clients/:clientId/messages/:messageId', (ctx, next) => {
    try {
      getMessageById(ctx.params.clientId, ctx.params.messageId, { delete: true });
      ctx.status = 200;
    }
    catch (err) {
      errorLogger(err, next);
    }
  });


// routes
app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3000);
console.info('Server listening on port 3000');

module.exports = app;
