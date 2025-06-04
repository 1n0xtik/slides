// npx http-server -o
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const slideContainer = document.getElementById('slideContainer');
    // Header elements
    const headerEl = document.querySelector('.header'); 
    const questionNumberEl = document.getElementById('newQuestionNumber'); // Updated ID
    const questionCategoryEl = document.getElementById('newQuestionCategory'); // Updated ID
    const timerCircleEl = document.getElementById('timerProgress'); // Updated ID
    const timerTextEl = document.getElementById('timer'); // Updated ID
    // Main content elements
    const questionSectionEl = document.getElementById('questionSection'); 
    const questionTextContentEl = document.getElementById('questionTextContent');
    const optionsContainerEl = document.getElementById('optionsContainer'); 
    const imageAreaEl = document.getElementById('imageArea'); 
    const slideImageEl = document.getElementById('slideImage');
    // Footer elements
    const footerEl = document.querySelector('.footer'); 
    const progressTextEl = document.getElementById('progressText'); // ID remains the same, but element is in new footer
    const startSequenceBtn = document.getElementById('startSequenceBtn');
    const showAnswerBtn = document.getElementById('showAnswerBtn');
    // const footerContestInfoEl = document.getElementById('footerContestInfo')?.querySelector('span'); // This element might not exist in the new footer structure or needs re-evaluation
    // const footerTimeScoreEl = document.getElementById('footerTimeScore')?.querySelector('span'); // This element might not exist
    const footerProgressBarEl = document.getElementById('footerProgressBar');
    const roundInfoDisplayEl = document.getElementById('roundInfoDisplay'); // New element for round info
 
 
    // Popup
    const timesUpPopupEl = document.getElementById('timeUpOverlay'); // Updated ID for new overlay

    // --- Configuration ---
    const DEBUG_MODE = false; // Set to true to enable debug mode
    const USE_SPEECH = true; // Set to false to disable all speech synthesis & audio file playback
    const SHOW_IMAGE_PLACEHOLDER_ON_ERROR = true; // If true, shows a placeholder if an image fails to load
    const IMAGE_PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E"; // Simple image icon
    const DELAY_NO_SPEECH_QUESTION = 1000; // ms to wait after showing question if no speech
    const DELAY_NO_SPEECH_OPTION = 500;  // ms to wait after showing an option if no speech
    const DELAY_NO_SPEECH_ANSWER = 1000; // ms to wait after showing answer if no speech

    // State variables
    let allQuestions = [];
    let contestRoundsData = []; // To store data from quy_che_thi.cac_vong_thi
    let currentQuestionIndex = 0;
    let currentQuestionData = null;
    let timerInterval;
    let timeLeft = 0; // Will be set per question
    const DEFAULT_TIME_PER_QUESTION = 30; // Default seconds, can be overridden by JSON
    let audioContext;
    let currentAudio = null;
    let sequenceInProgress = false;
    let answerShown = false;
    let currentBackgroundIndex = 0; // For cycling backgrounds

    const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'g']; // Possible option keys
    const backgroundStyles = [
        'bg-default',               // The original gradient
        'bg-image-1-gradient',
        'bg-image-1-stripes',
        'bg-image-2-gradient',
        'bg-image-2-stripes',
        'bg-image-3-gradient',
        'bg-image-3-stripes',
        'bg-abstract',
        'bg-wave',
        'bg-svg-pattern-1',
        'bg-svg-pattern-2',
        'bg-svg-pattern-3'
    ];

    // Initialize AudioContext
    function initAudio() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.error("Web Audio API is not supported in this browser.", e);
                progressTextEl.textContent = "Lỗi: Trình duyệt không hỗ trợ âm thanh.";
            }
        }
    }

    // --- Audio Playback ---
    async function playAudio(filePath, onEndCallback) {
        if (!USE_SPEECH || !audioContext || !filePath) { // Check USE_SPEECH
            if (onEndCallback) onEndCallback();
            return Promise.resolve();
        }

        // Stop any currently playing audio
        if (currentAudio && currentAudio.source) {
            currentAudio.source.stop();
            currentAudio.source.disconnect();
        }
        
        // Create a new audio object for each playback to handle 'ended' event correctly
        const audio = new Audio(filePath);
        currentAudio = audio; // Keep track of the current audio for potential interruption

        return new Promise((resolve, reject) => {
            audio.oncanplaythrough = () => {
                audio.play().catch(e => {
                    console.error(`Error playing audio ${filePath}:`, e);
                    if (onEndCallback) onEndCallback();
                    resolve(); // Resolve even on error to not block sequence
                });
            };
            audio.onended = () => {
                if (onEndCallback) onEndCallback();
                if (currentAudio === audio) currentAudio = null; // Clear if it's the one that ended
                resolve();
            };
            audio.onerror = (e) => {
                console.error(`Error loading audio ${filePath}:`, e);
                progressTextEl.textContent = `Lỗi tải file âm thanh: ${filePath.split('/').pop()}`;
                if (onEndCallback) onEndCallback();
                if (currentAudio === audio) currentAudio = null;
                resolve(); // Resolve to not block sequence
            };
            // Handle cases where oncanplaythrough might not fire (e.g. cached files)
            if (audio.readyState >= 3) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
                 audio.play().catch(e => {
                    console.error(`Error playing audio ${filePath} (readyState >=3):`, e);
                    if (onEndCallback) onEndCallback();
                    resolve();
                });
            }
        });
    }

    // --- UI Updates & Animations ---
    function animateElement(element, animationClass) {
        if (element) {
            const elementName = element.id || element.className.split(' ')[0] || 'unknownElement';
            console.log(`animateElement: Called for ${elementName} with animation class ${animationClass}`);
            console.log(`animateElement: BEFORE changes for ${elementName} - classList: ${element.classList.toString()}, opacity: ${getComputedStyle(element).opacity}, visibility: ${getComputedStyle(element).visibility}, display: ${getComputedStyle(element).display}`);

            // 1. Gỡ bỏ lớp ẩn ban đầu
            element.classList.remove('u-hidden-initially');

            // 2. Đặt lại visibility thành 'visible' và opacity ban đầu cho animation
            element.style.visibility = 'visible'; 
            element.style.opacity = '0'; // Bắt đầu animation từ trạng thái trong suốt
            console.log(`animateElement: AFTER visibility/opacity set for ${elementName} - classList: ${element.classList.toString()}, opacity: ${element.style.opacity}, visibility: ${element.style.visibility}`);

            // 3. Xóa các lớp animation cũ (nếu có)
            const knownAnimationClasses = ['slideInLeft', 'optionSlideInUp', 'imageFadeIn', 'question-appear', 'option-appear', 'image-appear'];
            knownAnimationClasses.forEach(cls => element.classList.remove(cls));
            
            // 4. Buộc trình duyệt reflow để áp dụng các thay đổi style trước khi thêm animation mới
            void element.offsetWidth; 

            // 5. Thêm lớp animation mới
            element.classList.add(animationClass);
            console.log(`animateElement: AFTER animationClass added for ${elementName} - classList: ${element.classList.toString()}`);

            // Optional: Log when animation ends
            element.addEventListener('animationend', () => {
                console.log(`animateElement: Animation ENDED for ${elementName}, final opacity: ${getComputedStyle(element).opacity}, visibility: ${getComputedStyle(element).visibility}`);
            }, { once: true });
        } else {
            console.warn('animateElement: Called with null or undefined element for animationClass:', animationClass);
        }
    }

    function getThemeClass(category) {
        if (!category) return 'header-footer-theme-default'; // Default theme for header/footer
        const normalizedCategory = category.toLowerCase().replace(/\s+/g, '-');
        if (normalizedCategory.includes('chính-sách-pháp-luật')) return 'header-footer-theme-cspl';
        if (normalizedCategory.includes('phòng-cháy-chữa-cháy')) return 'header-footer-theme-pccc';
        if (normalizedCategory.includes('y-tế')) return 'header-footer-theme-yte';
        if (normalizedCategory.includes('khai-thác-mỏ')) return 'header-footer-theme-ktm';
        if (normalizedCategory.includes('bảo-quản') || normalizedCategory.includes('bốc-xếp') || normalizedCategory.includes('vận-chuyển')) return 'header-footer-theme-bq-bx-vc';
        return 'header-footer-theme-default'; // Fallback
    }

    function applyTheme(category) {
        const themeClass = getThemeClass(category);
        // Define all possible theme classes to ensure only one is active on slideContainer
        const allClasses = [
            'header-footer-theme-default', 'header-footer-theme-cspl', 
            'header-footer-theme-pccc', 'header-footer-theme-yte', 
            'header-footer-theme-ktm', 'header-footer-theme-bq-bx-vc'
        ];
        // Apply theme to slideContainer, CSS will handle header/footer specifics
        if (slideContainer) {
            slideContainer.classList.remove(...allClasses); // Remove all theme classes
            slideContainer.classList.add(themeClass); // Add the new theme class
        }
    }


    function renderSlide(questionData) {
        console.log('--- renderSlide START ---', questionData);
        currentQuestionData = questionData;
        answerShown = false;
        sequenceInProgress = false;

        // Cycle through background styles
        if (slideContainer && backgroundStyles.length > 0) {
            // Remove all possible background style classes first
            backgroundStyles.forEach(bgClass => slideContainer.classList.remove(bgClass));
            
            // Add the new background style
            slideContainer.classList.add(backgroundStyles[currentBackgroundIndex]);
            
            // Update index for next slide
            currentBackgroundIndex = (currentBackgroundIndex + 1) % backgroundStyles.length;
        }
 
        const imageWrapperEl = document.getElementById('imageWrapper');

        if (questionSectionEl) questionSectionEl.classList.add('u-hidden-initially');
        if (optionsContainerEl) optionsContainerEl.classList.add('u-hidden-initially');
        if (imageAreaEl) imageAreaEl.classList.add('u-hidden-initially');
        
        if (questionSectionEl) {
            questionSectionEl.style.opacity = '0'; // Explicitly set for animation start
            console.log('renderSlide: questionSectionEl initial state - classList:', questionSectionEl.classList.toString(), 'opacity:', getComputedStyle(questionSectionEl).opacity, 'visibility:', getComputedStyle(questionSectionEl).visibility, 'display:', getComputedStyle(questionSectionEl).display);
        }
        if (imageWrapperEl) {
            imageWrapperEl.style.opacity = '0'; // Explicitly set for animation start
            console.log('renderSlide: imageWrapperEl initial state - classList:', imageWrapperEl.classList.toString(), 'opacity:', getComputedStyle(imageWrapperEl).opacity, 'visibility:', getComputedStyle(imageWrapperEl).visibility, 'display:', getComputedStyle(imageWrapperEl).display);
        }
         if (optionsContainerEl) { // Though options are dynamically added, good to log container state
            console.log('renderSlide: optionsContainerEl initial state - classList:', optionsContainerEl.classList.toString(), 'opacity:', getComputedStyle(optionsContainerEl).opacity, 'visibility:', getComputedStyle(optionsContainerEl).visibility, 'display:', getComputedStyle(optionsContainerEl).display);
        }

        questionTextContentEl.textContent = '';
        optionsContainerEl.innerHTML = ''; 
        slideImageEl.src = '';
        slideImageEl.alt = 'Hình ảnh minh họa';
        if(imageAreaEl) imageAreaEl.classList.add('hidden'); 
        
        progressTextEl.textContent = '';
        progressTextEl.classList.remove('answer-text-highlight'); // Remove highlight
        showAnswerBtn.style.display = 'none';
        startSequenceBtn.disabled = false;
        startSequenceBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'speaking-indicator');
        
        timesUpPopupEl.style.display = 'none';
        timesUpPopupEl.style.opacity = '0';


        // Update header
        if (questionNumberEl) questionNumberEl.textContent = currentQuestionIndex + 1;
        if (questionCategoryEl) questionCategoryEl.textContent = questionData.category || 'Không có danh mục';
        applyTheme(questionData.category);
 
        // Update footer progress bar
        if (footerProgressBarEl) footerProgressBarEl.style.width = `${((currentQuestionIndex + 1) / allQuestions.length) * 100}%`;
        
        // Update footer round information
        if (roundInfoDisplayEl && contestRoundsData.length > 0) {
            let cumulativeQuestions = 0;
            let currentRound = null;
            for (let i = 0; i < contestRoundsData.length; i++) {
                const round = contestRoundsData[i];
                if (currentQuestionIndex < cumulativeQuestions + round.so_cau_hoi) {
                    currentRound = round;
                    break;
                }
                cumulativeQuestions += round.so_cau_hoi;
            }

            if (currentRound) {
                roundInfoDisplayEl.innerHTML = `
                    <h3><i class="fas fa-trophy mr-2"></i>Vòng ${currentRound.vong}: ${currentRound.ten_vong}</h3>
                    <p>Thời gian trả lời: ${currentRound.thoi_gian_tra_loi} | Thang điểm: ${currentRound.thang_diem} điểm</p>
                `;
            } else {
                roundInfoDisplayEl.innerHTML = ''; // Clear if no round info found (should not happen)
            }
        }

        // Set question text
        questionTextContentEl.textContent = questionData.cau_hoi;

        // Prepare image 
        let showImageArea = questionData.use_image === 'Yes' && questionData.image_id;
        const questionTextLength = questionData.cau_hoi.length;

        if (questionData.question_image !== 'Yes' && questionTextLength > 250 && questionData.use_image === 'Yes') {
            showImageArea = false;
        }
        
        const questionOptionsSection = document.getElementById('questionOptionsArea');
        // The main content container is the one with class 'px-8.py-4.flex-grow.flex.overflow-hidden'
        const mainContentFlexContainer = document.querySelector('.px-8.py-4.flex-grow.flex.overflow-hidden');

        // Reset layout classes first
        if (mainContentFlexContainer) {
            mainContentFlexContainer.classList.remove('flex-col', 'flex-row'); // Remove old direction
        }
        if (questionOptionsSection) {
            questionOptionsSection.classList.remove('w-full', 'w-3/5', 'w-2/5', 'pr-6', 'pl-6');
            questionOptionsSection.style.order = ''; // Reset order
        }
        if (imageAreaEl) {
            imageAreaEl.classList.remove('w-full', 'w-3/5', 'w-2/5', 'pr-6', 'pl-6', 'h-2/3', 'py-4');
            imageAreaEl.style.order = ''; // Reset order
            imageAreaEl.classList.add('hidden'); // Default to hidden
        }


        slideImageEl.onload = () => {
            if(showImageArea && imageAreaEl) {
                imageAreaEl.classList.remove('hidden');
            }
        };
        slideImageEl.onerror = () => {
            if (SHOW_IMAGE_PLACEHOLDER_ON_ERROR) {
                slideImageEl.src = IMAGE_PLACEHOLDER_SVG;
                slideImageEl.alt = "Không tìm thấy hình ảnh, hiển thị ảnh mẫu";
                if(showImageArea && imageAreaEl) {
                    imageAreaEl.classList.remove('hidden');
                }
            } else {
                if(imageAreaEl) imageAreaEl.classList.add('hidden');
                 // If image area is hidden, questionOptionsSection should take full width
                if(questionOptionsSection) questionOptionsSection.classList.add('w-full');
                if(mainContentFlexContainer) mainContentFlexContainer.classList.add('flex-row'); // Ensure row layout if no image
            }
        };

        if (showImageArea && imageAreaEl && questionOptionsSection && mainContentFlexContainer) {
            // Ensure the image area is made visible if an image is supposed to be shown
            imageAreaEl.classList.remove('hidden');
            
            slideImageEl.src = questionData.image_id;
            slideImageEl.alt = `Hình ảnh cho câu ${questionData.id}`;
            // The line below is now redundant due to the above change, but harmless if onload also calls it.
            // imageAreaEl.classList.remove('hidden'); // Handled by onload

            if (questionData.question_image === 'Yes') {
                mainContentFlexContainer.classList.add('flex-col');
                questionOptionsSection.classList.add('w-full');
                questionOptionsSection.style.order = 1;
                imageAreaEl.classList.add('w-full', 'h-2/3', 'py-4'); // Adjust image height as needed
                imageAreaEl.style.order = 2;
                slideImageEl.classList.replace('object-cover', 'object-contain');
            } else if (questionData.position_image === 'Left') {
                mainContentFlexContainer.classList.add('flex-row');
                questionOptionsSection.classList.add('w-3/5', 'pl-6');
                questionOptionsSection.style.order = 2;
                imageAreaEl.classList.add('w-2/5', 'pr-6');
                imageAreaEl.style.order = 1;
                slideImageEl.classList.replace('object-contain', 'object-cover');
            } else { // Default to Right or if position_image is 'Right'
                mainContentFlexContainer.classList.add('flex-row');
                questionOptionsSection.classList.add('w-3/5', 'pr-6');
                questionOptionsSection.style.order = 1;
                imageAreaEl.classList.add('w-2/5', 'pl-6');
                imageAreaEl.style.order = 2;
                slideImageEl.classList.replace('object-contain', 'object-cover');
            }
        } else { // No image to show
            if(imageAreaEl) imageAreaEl.classList.add('hidden');
            if(questionOptionsSection) questionOptionsSection.classList.add('w-full');
            if(mainContentFlexContainer) mainContentFlexContainer.classList.add('flex-row');
        }

        if (questionData.phuong_an) {
            Object.entries(questionData.phuong_an).forEach(([key, value]) => {
                if (value) {
                    const optionKeyUpper = key.toUpperCase();
                    const optionEl = document.createElement('div');
                    optionEl.id = `option${optionKeyUpper}`;
                    optionEl.dataset.optionKey = key;
                    // Add Tailwind classes for card styling directly here
                    optionEl.classList.add('option-card', 'bg-white', 'bg-opacity-90', 'rounded-lg', 'p-4', 'border-l-4', 'border-gray-400');
                    optionEl.style.opacity = '0'; 

                    const optionCharClass = `option-char-${key.toLowerCase()}`;
                    // Ensure correct inner structure for flex layout and char styling
                    optionEl.innerHTML = `
                        <div class="flex items-center space-x-3">
                            <div class="option-char ${optionCharClass} text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">${optionKeyUpper}</div>
                            <span class="text-gray-800 font-medium">${value}</span>
                        </div>
                    `;
                    optionsContainerEl.appendChild(optionEl);
                }
            });
        }
        
        // Set timer
        timeLeft = parseInt(questionData.thoi_gian_tra_loi) || DEFAULT_TIME_PER_QUESTION;
        if (questionData.type_question === "Thực hành") {
             timeLeft = parseInt(questionData.thoi_gian_chuan_bi) * 60 || 300;
        }
        timerTextEl.textContent = timeLeft;
        timerCircleEl.style.strokeDashoffset = '226'; // Reset to full circumference for new timer
        timerCircleEl.classList.remove('warning', 'danger'); // Reset colors
        timerTextEl.classList.remove('warning', 'danger');   // Reset colors
        timerCircleEl.style.stroke = '#fff'; // Default stroke color from Test1.html CSS
        timerTextEl.style.color = '#fff'; // Default text color
    }

    // --- Timer Logic ---
    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);

        if (DEBUG_MODE) {
            progressTextEl.textContent = 'Chế độ DEBUG: Bỏ qua timer.';
            timeLeft = 0;
            timerTextEl.textContent = "DEBUG";
            if (currentQuestionData.type_question !== "Thực hành") {
                showAnswerBtn.style.display = 'inline-block'; // Or 'flex' depending on new CSS
                showAnswerBtn.disabled = false;
                showAnswerBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
            return;
        }

        if (USE_SPEECH && (currentQuestionData.speech_id_timer || 'speech/30s.mp3')) {
            playAudio(currentQuestionData.speech_id_timer || 'speech/30s.mp3');
        }

        const totalDuration = parseInt(currentQuestionData.thoi_gian_tra_loi) || DEFAULT_TIME_PER_QUESTION;
        // timerCircleEl.style.transition = `stroke-dashoffset ${totalDuration}s linear, stroke 0.3s ease`; // CSS handles transition
        
        // Animate stroke-dashoffset from current (likely 226) to 0 over totalDuration
        // This requires a bit more finesse if we want a smooth start after a potential delay
        // For simplicity, we assume CSS transition handles the animation once strokeDashoffset is set.
        // To trigger animation:
        void timerCircleEl.offsetWidth; // Force reflow
        timerCircleEl.style.strokeDashoffset = '0';


        timerInterval = setInterval(() => {
            timeLeft--;
            timerTextEl.textContent = timeLeft;
            // const progressRatio = timeLeft / totalDuration; // Not directly setting dashoffset here anymore

            // Update circle color based on Test1.html CSS classes
            timerCircleEl.style.stroke = '#fff'; // Default stroke color from Test1.html CSS
            timerTextEl.style.color = '#fff'; // Default text color

            const headerProgressBarEl = document.getElementById('headerProgressBar');
            const progressPercentage = (timeLeft / totalDuration) * 100;

            if (timeLeft <= Math.floor(totalDuration * 0.33)) {
                timerCircleEl.style.stroke = '#FF4444'; // Red for danger
                timerTextEl.style.color = '#FF4444';
                if (headerProgressBarEl) headerProgressBarEl.style.background = '#FF4444';
            } else if (timeLeft <= Math.floor(totalDuration * 0.66)) {
                timerCircleEl.style.stroke = '#FFA500'; // Orange for warning
                timerTextEl.style.color = '#FFA500';
                 if (headerProgressBarEl) headerProgressBarEl.style.background = '#FFA500';
            } else {
                timerCircleEl.style.stroke = '#10b981'; // Green
                timerTextEl.style.color = '#10b981';
                 if (headerProgressBarEl) headerProgressBarEl.style.background = '#10b981';
            }

            if (headerProgressBarEl) headerProgressBarEl.style.width = `${progressPercentage}%`;

            if (timeLeft <= Math.floor(totalDuration * 0.33)) { 
                timerCircleEl.classList.add('danger');
                timerTextEl.classList.add('danger');
            } else if (timeLeft <= Math.floor(totalDuration * 0.66)) { 
                timerCircleEl.classList.add('warning');
                timerTextEl.classList.add('warning');
            }
            // Default color is handled by CSS if no warning/danger class

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerTextEl.textContent = '0';
                timerCircleEl.style.strokeDashoffset = '0'; // Ensure it's full
                if (!DEBUG_MODE && timesUpPopupEl) {
                    timesUpPopupEl.style.display = 'flex'; 
                    // Trigger animation for timesUpPopupEl
                    timesUpPopupEl.style.opacity = '0';
                    void timesUpPopupEl.offsetWidth; // reflow
                    timesUpPopupEl.style.animation = 'fadeInOverlay 0.5s ease-out forwards, slideInTimeUp 0.6s ease-out forwards';
                    const timeUpContent = timesUpPopupEl.querySelector('.time-up-content');
                    if(timeUpContent) timeUpContent.style.animation = 'pulseTimeUpSmooth 2s ease-in-out infinite 0.6s';

                }
                progressTextEl.textContent = 'Hết giờ! Các đội giơ đáp án.';
                if (currentQuestionData.type_question !== "Thực hành") {
                    showAnswerBtn.style.display = 'inline-block'; // Or 'flex'
                    showAnswerBtn.disabled = false;
                    showAnswerBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                if (USE_SPEECH && currentQuestionData.speech_id_timeup) {
                    playAudio(currentQuestionData.speech_id_timeup);
                }
            }
        }, 1000);
    }    // --- Main Sequence Logic ---
    async function startQuestionSequence() {
        console.log('--- startQuestionSequence START ---');
        if (sequenceInProgress || answerShown) {
            console.log('startQuestionSequence: Aborted - sequenceInProgress:', sequenceInProgress, 'answerShown:', answerShown);
            return;
        }
        sequenceInProgress = true;
        initAudio();

        startSequenceBtn.disabled = true;
        startSequenceBtn.classList.add('opacity-50', 'cursor-not-allowed', 'speaking-indicator');

        // 1. Show Question and Image simultaneously
        const imageWrapperEl = document.getElementById('imageWrapper'); 
        
        // Start animations simultaneously
        if (questionSectionEl) questionSectionEl.classList.remove('u-hidden-initially');
        if (optionsContainerEl) optionsContainerEl.classList.remove('u-hidden-initially');
        if (imageAreaEl && slideImageEl.complete) imageAreaEl.classList.remove('u-hidden-initially');

        animateElement(questionSectionEl, 'question-appear');
        if (imageAreaEl && slideImageEl.complete) animateElement(imageAreaEl, 'image-appear');
        if (slideImageEl.src && imageAreaEl && !imageAreaEl.classList.contains('hidden') && imageWrapperEl) {
            console.log(`%cstartQuestionSequence: Attempting to animate image. Conditions: slideImageEl.src="${slideImageEl.src}", imageAreaEl exists=${!!imageAreaEl}, imageAreaEl.hidden=${imageAreaEl.classList.contains('hidden')}, imageWrapperEl exists=${!!imageWrapperEl}`, "color: green; font-weight: bold;");
            animateElement(imageWrapperEl, 'image-appear');
        } else {
            console.log(`%cstartQuestionSequence: Image will NOT be animated. Conditions: slideImageEl.src="${slideImageEl.src}", imageAreaEl exists=${!!imageAreaEl}, imageAreaEl.hidden=${imageAreaEl ? imageAreaEl.classList.contains('hidden') : 'N/A'}, imageWrapperEl exists=${!!imageWrapperEl}`, "color: red; font-weight: bold;");
        }
        
        // 2. Speak Question (after showing both question and image)
        if (USE_SPEECH && currentQuestionData.speech_id_question) {
            await playAudio(`speech/${currentQuestionData.speech_id_question}`);
        } else {
            await new Promise(r => setTimeout(r, DELAY_NO_SPEECH_QUESTION));
        }

        // 3. Show & Speak Options (if Trac nghiem)
        if (currentQuestionData.type_question === "Trắc nghiệm" && currentQuestionData.phuong_an) {
            const optionElements = optionsContainerEl.querySelectorAll('.option-card');
            console.log(`startQuestionSequence: Found ${optionElements.length} option elements to animate.`);
            
            let animationDelayBase = 0; // For staggering option animations
            for (let i = 0; i < optionElements.length; i++) {
                const optionEl = optionElements[i];
                console.log('startQuestionSequence: Animating option', optionEl.id);
                
                // Set animation delay for staggered effect
                optionEl.style.animationDelay = `${animationDelayBase}s`;
                animateElement(optionEl, 'option-appear');
                
                // Speak option if audio exists
                const optionKey = optionEl.dataset.optionKey;
                const speechFileKey = `speech_id_options_${optionKey.toUpperCase()}`;
                const speechFile = currentQuestionData[speechFileKey];
                
                if (USE_SPEECH && speechFile) {
                    await playAudio(`speech/${speechFile}`);
                } else {
                    await new Promise(r => setTimeout(r, DELAY_NO_SPEECH_OPTION));
                }
                
                animationDelayBase += 0.15; // Stagger next option by 150ms
            }
        } else if (currentQuestionData.type_question === "Thực hành") {
            // No options to show/speak for practical questions
            console.log('startQuestionSequence: Thực hành question - no options to show');
        }

        // 4. Start Timer
        if (DEBUG_MODE || timeLeft > 0) {
            startTimer();
        } else if (!DEBUG_MODE && timeLeft <= 0) { 
            showAnswerBtn.style.display = 'inline-block'; 
            showAnswerBtn.disabled = false;
            showAnswerBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        
        startSequenceBtn.classList.remove('speaking-indicator');
        sequenceInProgress = false;
    }    function highlightCorrectAnswer() {
        if (!currentQuestionData || !currentQuestionData.dap_an_dung) return;

        const correctAnswers = Array.isArray(currentQuestionData.dap_an_dung) 
                               ? currentQuestionData.dap_an_dung 
                               : [currentQuestionData.dap_an_dung];

        correctAnswers.forEach(correctKey => {
            const correctOptionEl = optionsContainerEl.querySelector(`[data-option-key="${correctKey.toLowerCase()}"]`);
            if (correctOptionEl) {
                // Add the correct-answer class which handles all styling
                correctOptionEl.classList.add('correct-answer');
                
                // Ensure the option is visible and smoothly animated
                correctOptionEl.style.transition = 'all 0.5s ease';
                
                // Add a slight delay for dramatic effect
                setTimeout(() => {
                    correctOptionEl.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }, 300);
            }
        });
    }
    
    async function displayAnswer() {
        if (answerShown || !currentQuestionData) return;
        answerShown = true;

        if (timerInterval) clearInterval(timerInterval);
        if (!DEBUG_MODE && timesUpPopupEl.style.display !== 'none') {
            timesUpPopupEl.style.opacity = '0'; // Start fade out
            setTimeout(() => timesUpPopupEl.style.display = 'none', 500); // Hide after fade
        }

        showAnswerBtn.disabled = true;
        showAnswerBtn.classList.add('opacity-50', 'cursor-not-allowed');
        
        let answerDisplayString = "";
        if (currentQuestionData.type_question === "Trắc nghiệm") {
            if (currentQuestionData.dap_an_dung) {
                const correctKeys = Array.isArray(currentQuestionData.dap_an_dung) 
                                    ? currentQuestionData.dap_an_dung 
                                    : [currentQuestionData.dap_an_dung];
                answerDisplayString = "Đáp án: " + correctKeys.map(k => k.toUpperCase()).join(', ');
                highlightCorrectAnswer();
            } else {
                answerDisplayString = "Không có đáp án cho câu này.";
            }
        } else if (currentQuestionData.type_question === "Lý thuyết tự luận" || currentQuestionData.type_question === "Câu hỏi hình ảnh") {
            if (typeof currentQuestionData.cau_tra_loi === 'string') {
                // For long answers, it might be better to just announce and refer to material
                answerDisplayString = `<span class="font-bold">Đáp án:</span> (Chi tiết trong tài liệu)`;
                 // If you want to show short answers:
                 // answerDisplayString = `<span class="font-bold">Đáp án:</span> ${currentQuestionData.cau_tra_loi}`;
            } else if (typeof currentQuestionData.cau_tra_loi === 'object' && currentQuestionData.cau_tra_loi !== null) {
                // Handle structured answers for "Câu hỏi hình ảnh"
                let structuredAnswer = "";
                for (const key in currentQuestionData.cau_tra_loi) {
                    structuredAnswer += `<p><strong>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> ${currentQuestionData.cau_tra_loi[key]}</p>`;
                }
                answerDisplayString = structuredAnswer; // This will be HTML
            }
             else {
                answerDisplayString = "Đáp án được trình bày bởi BGK/Tài liệu.";
            }
        } else if (currentQuestionData.type_question === "Thực hành") {
            answerDisplayString = "Ban giám khảo chấm điểm thực hành.";
        }

        progressTextEl.innerHTML = answerDisplayString; // Use innerHTML for potential HTML in answer
        progressTextEl.classList.add('answer-text-highlight'); // Add highlight class
 
        if (USE_SPEECH && currentQuestionData.speech_id_answer) {
            await playAudio(`speech/${currentQuestionData.speech_id_answer}`);
        } else if (!USE_SPEECH) {
            await new Promise(r => setTimeout(r, DELAY_NO_SPEECH_ANSWER));
        }
        // Enable navigation to next question
    }

    // --- Navigation ---
    function nextQuestion() {
        if (currentAudio && currentAudio.source) { // Stop any ongoing audio
            currentAudio.source.stop();
            currentAudio.source.disconnect();
            currentAudio = null;
        }
        if (timerInterval) clearInterval(timerInterval);

        if (currentQuestionIndex < allQuestions.length - 1) {
            currentQuestionIndex++;
            renderSlide(allQuestions[currentQuestionIndex]);
        } else {
            progressTextEl.innerHTML = '<span class="font-bold text-yellow-300">Đã hết câu hỏi. Cảm ơn đã tham gia!</span>';
            startSequenceBtn.disabled = true;
            showAnswerBtn.style.display = 'none';
        }
    }

    function previousQuestion() {
         if (currentAudio && currentAudio.source) {
            currentAudio.source.stop();
            currentAudio.source.disconnect();
            currentAudio = null;
        }
        if (timerInterval) clearInterval(timerInterval);

        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderSlide(allQuestions[currentQuestionIndex]);
        }
    }

    // --- Load Data ---
    async function loadQuestions() {
        try {
            const response = await fetch('ngan_hang_cau_hoi.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Store contest rounds data
            if (data.quy_che_thi && Array.isArray(data.quy_che_thi.cac_vong_thi)) {
                contestRoundsData = data.quy_che_thi.cac_vong_thi;
            }
            
            // Flatten questions from all categories and types
            const questionBank = data.ngan_hang_cau_hoi;
            for (const categoryKey in questionBank) {
                const category = questionBank[categoryKey];
                for (const typeKey in category) {
                    if (Array.isArray(category[typeKey])) {
                        allQuestions = allQuestions.concat(category[typeKey]);
                    }
                }
            }

            if (allQuestions.length > 0) {
                renderSlide(allQuestions[currentQuestionIndex]);
            } else {
                progressTextEl.textContent = "Không tìm thấy câu hỏi nào trong file JSON.";
            }
        } catch (error) {
            console.error("Could not load questions:", error);
            progressTextEl.textContent = "Lỗi tải dữ liệu câu hỏi. Vui lòng kiểm tra file JSON và console.";
        }
    }

    // --- Event Listeners ---
    startSequenceBtn.addEventListener('click', startQuestionSequence);
    showAnswerBtn.addEventListener('click', displayAnswer);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            if (DEBUG_MODE) {
                nextQuestion();
            } else if (answerShown || (currentQuestionData.type_question === "Thực hành" && timeLeft <= 0)) {
                 nextQuestion();
            } else if (!sequenceInProgress && !answerShown && timeLeft <=0 && currentQuestionData.type_question !== "Thực hành") {
                displayAnswer();
            }
        } else if (e.key === 'ArrowLeft') {
            previousQuestion();
        } else if (e.key === ' ' || e.key === 'Spacebar') { 
            e.preventDefault(); 
            if (!startSequenceBtn.disabled) {
                startQuestionSequence();
            }
        } else if (e.key === 'Enter') {
            if (!showAnswerBtn.disabled && showAnswerBtn.style.display !== 'none') {
                e.preventDefault();
                displayAnswer();
            }
        } else if (e.key.toLowerCase() === 'd' && e.ctrlKey) { // Ctrl+D to toggle debug
            e.preventDefault();
            // This is a simple way to toggle, for a real app, you might want a UI element
            // For now, this requires manual change of DEBUG_MODE constant and reload.
            // Or, we can make DEBUG_MODE a let and toggle it here, then re-render.
            console.log("Debug mode toggle attempted. Reload page if DEBUG_MODE constant was changed.");
        }
    });

    // --- Initialization ---
    loadQuestions();
});
