import type { Schema } from '../../data/resource';

export const handler: Schema['testFunction']['functionHandler'] = async (
  event,
  context
) => {
  // your function code goes here
  const { message } = event.arguments;

  console.log(message);

  return `${message}`;
};
