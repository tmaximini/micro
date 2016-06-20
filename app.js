const Koa = require('koa');
const Redis = require('ioredis');
const redis = new Redis();
const app = new Koa();
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser');

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
      .replace(':url', ctx.url);

    console.log(str);

    await next();
  };
}

async function errorHandler(ctx, next) {
  try {
    await next(); // next is now a function
  } catch (err) {
    ctx.body = { message: err.message };
    ctx.status = err.status || 500;
  }
}

// middleware
app.use(responseTime);
app.use(logger());
app.use(bodyParser());
app.use(errorHandler);


// returns all messages for a uuid and deletes them afterwards
async function popAllMessagesForUser(uuid) {
  const messages = [];
  const length = await redis.llen(uuid);
  for (var i = length - 1; i >= 0; i--) {
    let msg = await redis.lpop(uuid);
    messages.push(JSON.parse(msg));
  }
  return messages;
}


router
  .get('/:uuid', async (ctx, next) => {
    try {
      const messages = await popAllMessagesForUser(ctx.params.uuid);
      ctx.body = { messages };
    }
    catch (err) {
      next(new Error(err));
    }
  })
  .post('/:uuid', (ctx, next) => {
    try {
      const body = ctx.request.body;
      redis.lpush(ctx.params.uuid, JSON.stringify(body.message));
    }
    catch (err) {
      next(new Error(err))
    }
  });


// routes
app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3000);
console.info('Server listening on port 3000');

module.exports = app;
