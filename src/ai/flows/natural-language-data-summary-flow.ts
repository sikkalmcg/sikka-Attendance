'use server';
/**
 * @fileOverview This file implements a Genkit flow for natural language data summary.
 * It allows HR managers to query and summarize attendance and payroll data using natural language.
 *
 * - naturalLanguageDataSummary - A function that handles the natural language data summarization process.
 * - NaturalLanguageDataSummaryInput - The input type for the naturalLanguageDataSummary function.
 * - NaturalLanguageDataSummaryOutput - The return type for the naturalLanguageDataSummary function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const NaturalLanguageDataSummaryInputSchema = z.object({
  query: z.string().describe('The natural language query or request for data summary.'),
  attendanceData: z.string().optional().describe('A string representation of relevant attendance data, if available. For example: "Employee S001 marked IN at 9 AM, OUT at 5 PM on 2024-07-20. Employee S002 was absent on 2024-07-20."'),
  payrollData: z.string().optional().describe('A string representation of relevant payroll data, if available. For example: "Employee S001 net salary for July was 50000 INR, PF contribution 6000 INR."'),
});
export type NaturalLanguageDataSummaryInput = z.infer<typeof NaturalLanguageDataSummaryInputSchema>;

const NaturalLanguageDataSummaryOutputSchema = z.object({
  summary: z.string().describe('A natural language summary or insight based on the query and provided data.'),
});
export type NaturalLanguageDataSummaryOutput = z.infer<typeof NaturalLanguageDataSummaryOutputSchema>;

export async function naturalLanguageDataSummary(input: NaturalLanguageDataSummaryInput): Promise<NaturalLanguageDataSummaryOutput> {
  return naturalLanguageDataSummaryFlow(input);
}

const naturalLanguageDataSummaryPrompt = ai.definePrompt({
  name: 'naturalLanguageDataSummaryPrompt',
  input: { schema: NaturalLanguageDataSummaryInputSchema },
  output: { schema: NaturalLanguageDataSummaryOutputSchema },
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
  prompt: `You are an intelligent HR assistant and data analyst for Sikka Industries & Logistics.
Your task is to provide concise and insightful summaries or answer questions based on the provided attendance and payroll data.
Analyze the data to identify key trends, answer specific questions, or generate ad-hoc reports as requested by the HR manager.
If data is not provided or insufficient to answer the query, state that.

Attendance Data: {{{attendanceData}}}
Payroll Data: {{{payrollData}}}

HR Manager's Query: """{{{query}}}"""

Provide your natural language summary or answer:`,
});

const naturalLanguageDataSummaryFlow = ai.defineFlow(
  {
    name: 'naturalLanguageDataSummaryFlow',
    inputSchema: NaturalLanguageDataSummaryInputSchema,
    outputSchema: NaturalLanguageDataSummaryOutputSchema,
  },
  async (input) => {
    // In a real application, the `attendanceData` and `payrollData` would be fetched
    // from the database based on the `input.query` or other context before calling the prompt.
    // For this example, we assume these are already provided in the input.
    const { output } = await naturalLanguageDataSummaryPrompt(input);
    return output!;
  }
);
