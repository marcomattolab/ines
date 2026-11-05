/// <reference lib="webworker" />
import { env, pipeline, RawImage } from '@huggingface/transformers';

let captioner: any = null;

addEventListener('message', async ({ data }) => {
  try {
    if (data.type === 'init') {
      env.allowRemoteModels = true;
      env.allowLocalModels = false;
      captioner = await (pipeline as any)('image-to-text', data.modelId, {
        device: data.device,
        progress_callback: (p: unknown) => postMessage({ type: 'progress', p }),
      });
      postMessage({ type: 'ready' });
    } else if (data.type === 'caption') {
      const image = new RawImage(data.data, data.width, data.height, 4);
      const out = await captioner(image, { max_new_tokens: 40 });
      postMessage({ type: 'result', id: data.id, text: out[0].generated_text });
    }
  } catch (e) {
    postMessage({
      type: 'error',
      id: data.id,
      message: e instanceof Error ? e.message : String(e),
    });
  }
});
