# Project TODOs

- The AI sutibiluty prompt should only ask for the work item ID not additional info

- Context not auto filling in AI sutabilty prompt

- Create an additional prompt that takes a item, and analyses each of it's children:
    - If too big, split up
    - If missing details, enhance
    - If should be dead, remove
    
    - Analysis child items and come up with a parall exicution plan that maximizes how many things can be done at once
    - Assign items in first block to AI if they are AI sutable

- Create a prompt that analyses the work assigned to each person on the team and reports their velocity and strengths and weaknesses based on what they have completed. Make recommendations to improve team health based on assignments. You may create any additional tools needed to do this.

- Update the readme to include instructions with info on configuring access to sampling. You will need to check the latest VSCode docs as this is a very new feature

- Only offer sampling features when that is actually supported. When sampling is not enabled, do not offer these features.  

- Make the AI responses for sampling features smaller and more focused so they don't eat our context

- All tools should have documentation of schema

- Idea: Would it be feasable to add tools for finding a list of repos/area paths that the current user comonly uses?