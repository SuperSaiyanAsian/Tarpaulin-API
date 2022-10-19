// https://stackoverflow.com/questions/70145795/node-redis-does-not-work-on-my-windows-computer-even-though-the-server-is-up-and
// Find Rate limiting class material in last year by searching "osu-cs493-" users
// https://github.com/osu-cs493-sp21/rate-limiting/blob/main/server.js

const redis = require('redis')
const {requireAuthentication_Ratelimit} = require('./auth')
const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = process.env.REDIS_PORT || 6379


const redisClient = redis.createClient(redisPort, redisHost)

redisClient.on('connect', function(){
    console.log('Connected to Redis')
})

redisClient.on('error', function(err) {
    console.log('Redis error: ' + err)
})


// default for 10, auth user for 30
let rateLimitMaxRequests = 10
// 60s
const rateLimitWindowMs = 60000

function getUserTokenBucket(ip) {
    return new Promise((resolve, reject) => {
        redisClient.hgetall(ip, (err, tokenBucket) => {
            if (err) {
                reject(err)
            } else if (tokenBucket) {
                tokenBucket.tokens = parseFloat(tokenBucket.tokens)
                resolve(tokenBucket)
            } else {
                resolve({
                    tokens: rateLimitMaxRequests,
                    last: Date.now()
                })
            }
        })
    })
}

function saveUserTokenBucket(ip, tokenBucket) {
    return new Promise((resolve, reject) => {
        redisClient.hmset(ip, tokenBucket, (err, resp) => {
        if (err) {
            reject(err)
        } else {
            resolve()
        }
        })
    })
}

exports.rateLimit = async (req, res, next) => {
    try {
        isAuth = requireAuthentication_Ratelimit(req, res, next)
        if(isAuth){
            rateLimitMaxRequests = 30
        }else{
            rateLimitMaxRequests = 10
        }
        const tokenBucket = await getUserTokenBucket(req.ip)
        console.log("== tokenBucket: ", tokenBucket)
        const currentTimestamp = Date.now()
        const ellapsedTime = currentTimestamp - tokenBucket.last
        tokenBucket.tokens += ellapsedTime * (rateLimitMaxRequests / rateLimitWindowMs)
        tokenBucket.tokens = Math.min( tokenBucket.tokens, rateLimitMaxRequests)
        tokenBucket.last = currentTimestamp
        if (tokenBucket.tokens >= 1) {
            tokenBucket.tokens -= 1
            await saveUserTokenBucket(req.ip, tokenBucket)
            next()
        } else {
            res.status(429).send({
                error: "Too many requests per minute.  Please wait a bit..."
            })
        }
    } catch (err) {
        next()
    }
}
/*
exports.rateLimit = async (req, res, next) => {
    const ip = req.ip

    let tokenBucket = await redisClient.hGetAll(ip)
    try {
      tokenBucket = parseFloat(tokenBucket.tokens)
    } catch (e) {
      next()
      return
    }
    console.log("== tokenBucket:", tokenBucket)
    tokenBucket = {
      tokens: parseFloat(tokenBucket.tokens) || rateLimitMaxRequests,
      last: parseInt(tokenBucket.last) || Date.now()
    }
    console.log("== tokenBucket:", tokenBucket)

    const now = Date.now()
    const ellapsedMs = now - tokenBucket.last
    tokenBucket.tokens += ellapsedMs * (rateLimitMaxRequests / rateLimitWindowMs)
    tokenBucket.tokens = Math.min(rateLimitMaxRequests, tokenBucket.tokens)
    tokenBucket.last = now

    if (tokenBucket.tokens >= 1) {
      tokenBucket.tokens -= 1
      await redisClient.hSet(ip, [['tokens', tokenBucket.tokens], ['last', tokenBucket.last]])
      next()
    } else {
      await redisClient.hSet(ip, [['tokens', tokenBucket.tokens], ['last', tokenBucket.last]])
      res.status(429).send({
        err: "Too many requests per minute"
      })
    }
  }
  */