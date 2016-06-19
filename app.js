const Koa = require('koa');
const Redis = require('ioredis');
const redis = new Redis();
const app = new Koa();
const router = require('koa-router')();


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
app.use(errorHandler);



async function getMessages() {
  const msg = await redis.get('foo');
  return msg;
}


router
  .get('/', (ctx, next) => {
    try {
      ctx.body = { message: getMessages() }
    }
    catch (err) {
      next(new Error(err));
    }
  })
  .post('/', (ctx, next) => {
    try {
      redis.set('foo', Math.random() * 1000);
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
