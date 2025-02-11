export function toReadableStream(asyncIterable: AsyncIterable<any>): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of asyncIterable) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}
