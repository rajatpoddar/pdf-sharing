'use server';

/**
 * @fileOverview Implements the AI project suggestion flow based on user download history.
 *
 * - suggestProjects - A function that suggests projects based on user download history.
 * - SuggestProjectsInput - The input type for the suggestProjects function.
 * - SuggestProjectsOutput - The return type for the suggestProjects function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestProjectsInputSchema = z.object({
  downloadHistory: z
    .array(z.string())
    .describe('An array of project filenames the user has downloaded in the past.'),
  numSuggestions: z
    .number()
    .default(3)
    .describe('The number of project suggestions to return.'),
});
export type SuggestProjectsInput = z.infer<typeof SuggestProjectsInputSchema>;

const SuggestProjectsOutputSchema = z.object({
  suggestions: z
    .array(z.string())
    .describe('An array of suggested project filenames based on download history.'),
});
export type SuggestProjectsOutput = z.infer<typeof SuggestProjectsOutputSchema>;

export async function suggestProjects(input: SuggestProjectsInput): Promise<SuggestProjectsOutput> {
  return suggestProjectsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestProjectsPrompt',
  input: {schema: SuggestProjectsInputSchema},
  output: {schema: SuggestProjectsOutputSchema},
  prompt: `You are a project suggestion expert. Given a user's past project download history,
you will suggest relevant projects that the user might be interested in.

Download History: {{#each downloadHistory}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Suggest {{numSuggestions}} project filenames based on the download history.  Do not suggest the same projects that the user has already downloaded.
Return the suggestions as a JSON array of strings.`,
});

const suggestProjectsFlow = ai.defineFlow(
  {
    name: 'suggestProjectsFlow',
    inputSchema: SuggestProjectsInputSchema,
    outputSchema: SuggestProjectsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
