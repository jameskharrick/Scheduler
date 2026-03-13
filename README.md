Scheduler for Kay! 

I was asked to make an automated Excel speadsheet that allowed her to easily create her appointment schedule for work. 
Excel sounded yucky, so I decided to build a new scheduler that fit exactly her use case, with the help of Claud (almost exclusively).


# PT Scheduler

A physical therapy scheduling tool for managing weekly patient appointments. Built with React, TypeScript, and Vite. Runs entirely in the browser — no backend, no account required.

## Features

**Appointment Management**
- Add, edit, and delete appointments across a Mon–Fri weekly grid
- Set name, additional patients, time, duration, location, color, and notes
- Recurring appointments that repeat every week automatically
- Drag and drop appointments to change day or time
- Drag the top or bottom edge of an appointment to resize start/end time

**Series & Instance Control**
- When editing or deleting a recurring appointment, choose to apply the change to this week only or all instances
- Label-generated appointments (see below) support the same per-instance controls

**Label / Slot System**
- Assign number (1–6) or letter (A–D) sequence labels to days of the week
- Appointments tagged with a matching label automatically appear as copies on those days
- Edit or delete individual label-generated copies without affecting the original or other instances

**Open Slots Panel**
- Automatically calculates and displays open appointment slots for the week

**Week Navigation**
- Browse forward and backward by week
- "This Week" shortcut always returns to the current week

**Print Support**
- Clean print layout with UI chrome hidden

## Data Storage

All appointments are saved to your browser's `localStorage`. No data is sent to any server. Clearing your browser's site data will erase appointments.

## Tech Stack

- React 19
- TypeScript
- Vite

## Development

```bash
npm install
npm run dev
