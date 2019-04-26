'use strict';

if (process.env.STAGE !== 'prod-stage-test') {
  throw new Error('Environmental variable STAGE is not defined');
}

module.exports.hello = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Go Serverless v1.0! Your function executed successfully!',
      input: event,
    }),
  };

  if (process.env.STAGE !== 'prod-stage-test') {
    return callback('Environmental variable STAGE is incorrect');
  }

  return callback(null, response);

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};
