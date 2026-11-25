import { describe, expect, it } from 'vitest';
import { buildEditPrompt, buildFinalPrompt, buildJobs } from './studio.prompts';
import { parseEditRequest, parseFinalRequest, parseRedesignRequest } from './studio.schema';

const image = 'data:image/jpeg;base64,AAAA';
const base = { image, width: 1000, height: 750, roomType: 'kitchen' };
const area = { x: 0, y: 0.6, w: 0.4, h: 0.4 };
const xaiRef = (i: number) => `<IMAGE_${i}>`;

// Every image prompt must keep the room and camera still and forbid extras.
const KEEPS_CAMERA = /same camera position, lens, perspective/;
const NO_EXTRAS = /no people, text, logos or watermarks/;

describe('buildEditPrompt', () => {
  it('a catalogue finish: names the part and area, keeps its shape', () => {
    const prompt = buildEditPrompt(parseEditRequest({ ...base, part: 'base-cabinets', finish: { material: 'laminate', shade: 'sage' }, area }), xaiRef);
    expect(prompt).toMatch(/^Edit this photo of a kitchen\. Change the base \(lower\) cabinet shutters/);
    expect(prompt).toContain('lower left');
    expect(prompt).toContain('to sage green (#9AA98F) laminate.');
    expect(prompt).toMatch(/exactly the same shape, size and outline, with every door and drawer line/);
    expect(prompt).toMatch(KEEPS_CAMERA);
    expect(prompt).toMatch(NO_EXTRAS);
  });

  it("staff's own words go in as a detail, not the whole prompt", () => {
    const prompt = buildEditPrompt(parseEditRequest({ ...base, text: 'walnut with fluted grooves.', area }), xaiRef);
    expect(prompt).toContain('For the lower left part of the photo (about 0–40% from the left and 60–100% from the top): walnut with fluted grooves.');
    expect(prompt).toMatch(KEEPS_CAMERA);
  });

  it('an item photo: names both images with the provider’s convention', () => {
    const prompt = buildEditPrompt(parseEditRequest({ ...base, reference: image, area }), (i) => `image ${i + 1}`);
    expect(prompt).toMatch(/^Edit image 1, a photo of a kitchen\. Put the item shown in image 2 into image 1/);
    expect(prompt).toContain('never the background');
  });
});

describe('buildJobs', () => {
  it('one job per option, listing changes and locking the rest by name', () => {
    const jobs = buildJobs(
      parseRedesignRequest({ ...base, variants: [{ elements: { 'base-cabinets': { material: 'laminate', shade: 'navy' } } }, { elements: {}, notes: 'warm light' }] }),
      xaiRef,
    );
    expect(jobs.map((j) => j.label)).toEqual(['Option A', 'Option B']);
    expect(jobs[0].prompt).toContain('1. Change the base (lower) cabinet shutters and drawer fronts to navy blue (#24324A) laminate.');
    expect(jobs[0].prompt).toMatch(/Keep everything else exactly as in the photo/);
    expect(jobs[0].prompt).toContain('the current material, colour and finish of the wall-hung cabinet shutters');
    expect(jobs[1].prompt).toContain("Designer's note: warm light");
    expect(jobs[0].specs[0]).toMatchObject({ label: 'Base cabinets' });
  });

  it('a render becomes a photo of the same design', () => {
    const [job] = buildJobs(parseRedesignRequest({ ...base, source: 'render', variants: [{}] }), xaiRef);
    expect(job.prompt).toMatch(/^Turn this Cabinet Vision 3D render/);
    expect(job.prompt).toMatch(/Keep the design exactly as drawn/);
  });
});

describe('buildFinalPrompt', () => {
  it('only improves quality', () => {
    const prompt = buildFinalPrompt(parseFinalRequest(base));
    expect(prompt).toMatch(/Keep everything exactly as it is/);
    expect(prompt).toMatch(/Do not add, remove or restyle anything/);
    expect(prompt).toMatch(NO_EXTRAS);
  });
});
