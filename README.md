# Meeting Assistant for `screenpipe`

> See demo videos: https://github.com/Glavin001/screenpipe-meeting-assistant/issues/1

Meeting Assistant is a real-time meeting enhancement tool built on top of Screenpipe. It leverages Screenpipe’s continuous multi-modal capture (screen, audio, and interaction events) to provide live transcription, intelligent mapping of pre-defined call goals, and dynamic AI-driven suggestions for follow-up questions—all during your meetings.

## Features
- **Real-Time Transcription:** Continuously transcribes meeting audio using Screenpipe’s live capture.
- **Pre-Defined Goals & Questions:** Automatically detects and maps answers to your preset call goals or questions.
- **Dynamic Question Suggestions:** Uses AI (via pre-trained LLMs) to suggest context-aware follow-up questions in real time.
- **Structured Data Capture:** Logs key meeting details for review and export.
- **Local-First Processing:** Ensures low-latency performance and robust privacy by processing all data locally.


- [x] Real-time transcription
- [x] Organize real-time notes into respective questions
- [x] Identify the current question being discussed and automatically mark question as in progress
- [ ] Recommend the next question to discussion (helpful if long list)
- [ ] Recommend new questions based on what is being discussed

- Use Framer Motion to show the questions being re-ordered automatically based on AI recommended order.
- start and end time for notes. end time is required by default, start allows a range UI
- paste in contents from another doc to auto format as questions (title, description, order)
- question templates (can create and import multiple into 1 call)
- click on a note to highlight where transcript when it was said (preferrable range)

## How It Works
1. **Capture:** Screenpipe records your screen and audio continuously.
2. **Transcription:** Live transcription converts speech into text in real time.
3. **Analysis:** An AI component analyzes the transcript to match pre-defined questions and generate context-sensitive question suggestions.
4. **Action:** The UI displays real-time suggestions and logs captured answers for post-meeting review.

## Installation

```bash

```


The AI notepad for people in back-to-back meetings

the meeting pipe takes your raw meeting recordings and makes them awesome

https://github.com/user-attachments/assets/8838c562-5bae-41cd-bc56-3c1785b21fc1
