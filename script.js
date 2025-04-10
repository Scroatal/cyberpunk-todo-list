// DOM Element References
const taskInput = document.getElementById('taskInput'); // Manual task input
const addTaskBtn = document.getElementById('addTaskBtn'); // Manual add button
const taskList = document.getElementById('taskList'); // UL for tasks
const sendSummaryBtn = document.getElementById('sendSummaryBtn'); // Send summary button
const threeCanvasContainer = document.getElementById('three-canvas-container'); // For Three.js
const emailInput = document.getElementById('emailInput'); // Feedback paste textarea
const fileInput = document.getElementById('fileInput'); // Feedback file input
const parseEmailBtn = document.getElementById('parseEmailBtn'); // Parse button
const clearAllBtn = document.getElementById('clearAllBtn'); // Clear All button
const recipientEmailInput = document.getElementById('recipientEmail'); // Recipient email input

// --- To-Do List Logic ---
let tasks = []; // Array to hold task objects {id: number, text: string, completed: boolean}

// Function to load tasks from local storage
function loadTasks() {
    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
        try {
            const parsedTasks = JSON.parse(storedTasks);
            // Filter out invalid tasks (ensure essential properties exist)
            tasks = Array.isArray(parsedTasks) ? parsedTasks.filter(task =>
                task && typeof task.id !== 'undefined' && typeof task.text === 'string' && typeof task.completed === 'boolean'
            ) : [];
            if (tasks.length !== parsedTasks.length) {
                console.warn("Filtered out some invalid task data from localStorage.");
                saveTasks(); // Save the cleaned list back
            }
        } catch (error) {
            console.error("Error parsing tasks from localStorage:", error);
            tasks = []; // Reset tasks if parsing fails
            localStorage.removeItem('tasks'); // Clear corrupted data
        }
    } else {
        tasks = []; // Ensure tasks is an empty array if nothing is stored
    }
    renderTasks();
}

// Function to save tasks to local storage
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Function to render tasks to the DOM
function renderTasks() {
    taskList.innerHTML = ''; // Clear existing list items
    tasks.forEach(task => {
        const li = document.createElement('li');
        // Set base text content first
        li.textContent = task.text;
        li.dataset.id = task.id; // Store task ID on the element

        if (task.completed) {
            li.classList.add('completed');
            // Prepend checkmark for completed tasks
            li.textContent = '✓ ' + li.textContent;
        }

        // Add click listener for toggling completion
        li.addEventListener('click', () => toggleTaskCompletion(task.id));

        // Only add delete button if the task is NOT completed
        if (!task.completed) {
            const completeBtn = document.createElement('button');
            completeBtn.textContent = 'Complete'; // Change text
            completeBtn.classList.add('complete-btn'); // Change class
            completeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent li click event from firing
                toggleTaskCompletion(task.id); // Change action to complete
            });
            li.appendChild(completeBtn);
        }

        // Add listeners for Three.js hover effect
        li.addEventListener('mouseenter', () => {
            const rect = li.getBoundingClientRect();
            const event = new CustomEvent('listItemMouseEnter', { detail: { rect } });
            document.dispatchEvent(event);
        });

        li.addEventListener('mouseleave', () => {
            const event = new CustomEvent('listItemMouseLeave');
            document.dispatchEvent(event);
        });

        taskList.appendChild(li);
    });
}

// Function to add a new task (accepts text as argument)
function createTask(taskText) {
    const trimmedText = taskText.trim();
    if (trimmedText === '') {
        // Don't add empty tasks silently when parsing
        return false;
    }

    // Optional: Check if task already exists (simple check)
    if (tasks.some(task => task && typeof task.text === 'string' && task.text.toLowerCase() === trimmedText.toLowerCase())) {
        console.log(`Task already exists: "${trimmedText}"`);
        return false; // Don't add duplicates from parsing
    }

    const newTask = {
        id: Date.now() + Math.random(), // Add random to timestamp for higher uniqueness chance
        text: trimmedText,
        completed: false
    };

    tasks.push(newTask);
    return true; // Indicate task was added
}

// Function to handle adding task from the manual input field
function handleManualAddTask() {
    const taskText = taskInput.value.trim();
     if (taskText === '') {
        alert('Please enter a task!'); // Simple validation for manual input
        return;
    }
    if (createTask(taskText)) {
        taskInput.value = ''; // Clear input field only if task was added
        saveTasks();
        renderTasks();
    } else {
         alert('Task might be empty or already exist.');
    }
}

// Function to determine input source: file or text
function getFeedbackInput() {
    const file = fileInput.files[0]; // Get the selected file
    const textContent = emailInput.value.trim();

    if (file) {
        // Prioritize file if selected
        const allowedTypes = ["text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        if (allowedTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.docx')) {
             // Clear textarea if using file
             emailInput.value = '';
             return { type: 'file', data: file };
        } else {
            alert("Please select a valid file type (.txt or .docx).");
            fileInput.value = ''; // Clear invalid file selection
            return null;
        }
    } else if (textContent) {
        // Use text area content if no file and text exists
        // Clear file input if using textarea
        fileInput.value = '';
        return { type: 'text', data: textContent };
    } else {
        // No input provided
        alert("Please paste text or select a .txt/.docx file.");
        return null;
    }
}


// Updated function to parse tasks using AI backend
// Updated function to parse tasks using AI backend (handles file or text)
async function parseAndAddTasksAI() {
    const inputSource = getFeedbackInput();

    if (!inputSource) {
        return; // Error message already shown by getFeedbackInput
    }

    // --- UI Feedback: Start Loading ---
    parseEmailBtn.disabled = true;
    parseEmailBtn.textContent = 'Parsing with AI...';
    // Optional: Add a visual spinner element here

    let fetchOptions = {
        method: 'POST',
    };
    let requestBody;

    if (inputSource.type === 'file') {
        // --- Prepare FormData for file upload ---
        requestBody = new FormData();
        requestBody.append('feedbackFile', inputSource.data); // Key 'feedbackFile' expected by backend
        fetchOptions.body = requestBody;
        // DO NOT set Content-Type header, browser does it for FormData
    } else {
        // --- Prepare JSON for text input ---
        requestBody = JSON.stringify({ emailText: inputSource.data });
        fetchOptions.body = requestBody;
        fetchOptions.headers = {
            'Content-Type': 'application/json',
        };
    }

    try {
        // --- Make API Call ---
        // IMPORTANT: This endpoint '/api/parse-email-ai' does NOT exist yet.
        // It needs to be created on a backend server that calls the Gemini API
        // AND can handle both 'multipart/form-data' (for files) and 'application/json' (for text).
        const backendUrl = 'http://localhost:3000/api/parse-email-ai'; // Use absolute URL
        const response = await fetch(backendUrl, fetchOptions);

        // --- Handle Response ---
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error fetching data' }));
            throw new Error(`AI parsing failed: ${response.status} ${response.statusText}. ${errorData.message || ''}`);
        }

        const parsedTasks = await response.json(); // Expecting { tasks: ["task1", "task2", ...] }

        if (!Array.isArray(parsedTasks.tasks)) {
             throw new Error('Invalid response format from AI parser.');
        }

        // --- Add Tasks to List ---
        let tasksAddedCount = 0;
        if (parsedTasks.tasks.length > 0) {
            parsedTasks.tasks.forEach(taskText => {
                if (createTask(taskText)) {
                    tasksAddedCount++;
                }
            });
            saveTasks();
            renderTasks();
            alert(`AI added ${tasksAddedCount} tasks.`);
            // Clear inputs after successful processing
            emailInput.value = '';
            fileInput.value = '';
        } else {
            alert('AI did not find any actionable tasks in the provided text.');
        }

    } catch (error) {
        console.error('Error during AI parsing:', error);
        alert(`Error contacting AI parser: ${error.message}\n\n(Note: Backend endpoint /api/parse-email-ai needs to be implemented and handle file uploads)`);
    } finally {
        // --- UI Feedback: End Loading ---
        parseEmailBtn.disabled = false;
        parseEmailBtn.textContent = 'Parse Tasks from Input';
        // Optional: Remove spinner element here
    }
}


// Function to toggle task completion
function toggleTaskCompletion(id) {
    tasks = tasks.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task
    );
    saveTasks();
    renderTasks();
}

// Function to delete a task
function deleteTask(id) {
    tasks = tasks.filter(task => task.id !== id);
    saveTasks();
    renderTasks();
}

// Function to clear all tasks
function clearAllTasks() {
    if (tasks.length === 0) {
        alert("Task list is already empty!");
        return;
    }
    // Confirm before clearing
    if (confirm("Are you sure you want to clear ALL tasks? This cannot be undone.")) {
        tasks = []; // Empty the array
        saveTasks(); // Update local storage
        renderTasks(); // Update the UI
        console.log("All tasks cleared.");
    }
}

// --- Email Summary Logic ---
// Function to compile completed tasks summary
function compileEmailSummary() {
    const completedTasks = tasks.filter(task => task.completed);

    if (completedTasks.length === 0) {
        return "No tasks completed today.";
    }

    let summary = "Today's Completed Tasks:\n";
    summary += "--------------------------\n";
    completedTasks.forEach(task => {
        summary += `- ${task.text}\n`;
    });
    summary += "--------------------------";

    return summary;
}

// Function to send summary to the backend API endpoint
async function sendSummaryToBackend(summaryText, recipientEmail) { // Add recipientEmail parameter
    console.log(`Attempting to send summary via backend to ${recipientEmail}...`);

    // --- UI Feedback: Start Loading ---
    sendSummaryBtn.disabled = true; // Disable button during sending
    sendSummaryBtn.textContent = 'Sending...';

    try {
        const backendUrl = 'http://localhost:3000/api/send-summary'; // Use absolute URL
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ summaryText: summaryText, recipientEmail: recipientEmail }), // Send summary and recipient
        });

        const result = await response.json(); // Get response body (e.g., { message: "..." })

        if (!response.ok) {
            throw new Error(result.message || `Failed to send summary: ${response.status} ${response.statusText}`);
        }

        console.log("Backend response:", result);
        alert(result.message || "Summary sent successfully!"); // Show success message from backend

    } catch (error) {
        console.error('Error sending summary:', error);
        alert(`Error sending summary: ${error.message}\n\n(Ensure backend server is running and email is configured correctly in .env)`);
    } finally {
        // --- UI Feedback: End Loading ---
        sendSummaryBtn.disabled = false;
        sendSummaryBtn.textContent = 'Send Daily Summary';
    }
}

// --- Event Listeners ---
addTaskBtn.addEventListener('click', handleManualAddTask); // Use the handler

taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleManualAddTask(); // Use the handler
    }
});

// Note: Task list click listeners (toggle/delete) are added dynamically in renderTasks()

// Listener for sending the summary
sendSummaryBtn.addEventListener('click', () => {
    const recipientEmail = recipientEmailInput.value.trim();
    if (!recipientEmail) {
        alert("Please enter a recipient email address.");
        recipientEmailInput.focus();
        return;
    }
    // Basic email format validation (optional but recommended)
    if (!/^\S+@\S+\.\S+$/.test(recipientEmail)) {
         alert("Please enter a valid email address format.");
         recipientEmailInput.focus();
         return;
    }

    console.log("Send Summary button clicked.");
    const summary = compileEmailSummary();
    console.log("Compiled Summary:\n", summary);
    // Call the function to send summary to backend, passing the recipient
    sendSummaryToBackend(summary, recipientEmail);
});

// Listener for parsing email content
parseEmailBtn.addEventListener('click', parseAndAddTasksAI); // Use the new AI function

// Listener for clearing all tasks
clearAllBtn.addEventListener('click', clearAllTasks);
// --- Initial Load ---
document.addEventListener('DOMContentLoaded', loadTasks); // Load tasks when the DOM is ready

console.log("Core script with To-Do logic loaded.");