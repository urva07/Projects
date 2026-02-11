import React, {useEffect, useRef } from "react";
import { io } from "socket.io-client";
import './App.css'
import { useLocation } from 'react-router-dom';
import axios from 'axios';

let inputRef = null;

let chatBoxRef = null;

let unseenMessages = [];

let receiv = null;

let roomId = null;

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

function getCurrentTime(now) {

    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; // 0 => 12

    const minutesStr = minutes < 10 ? '0' + minutes : minutes;

    const timeStr = `${hours}:${minutesStr} ${ampm}`;

    return timeStr;
}

function getMsgBox(type, data, loaded = false) {
    const pElement = document.createElement("p");
    type == "send" ? pElement.classList.add("send_msg_box_p") : pElement.classList.add("received_msg_box_p")
    pElement.textContent = data.msg;

    const msgBox = document.createElement("div");
    type == "send" ? msgBox.classList.add("send_msg_box") : msgBox.classList.add("received_msg_box")

    const timeP_element = document.createElement("p");
    type == "send" ? timeP_element.classList.add("send_msg_time") : timeP_element.classList.add("received_msg_time");
    timeP_element.textContent = getCurrentTime(new Date(data.sender_time));

    msgBox.appendChild(pElement);
    if (type == "send") {
        const timeAndTickMarksContainer = document.createElement("div");
        timeAndTickMarksContainer.classList.add("time_and_tick_marks_container")
        timeAndTickMarksContainer.appendChild(timeP_element)

        var tickMark1 = document.createElement("p");
        tickMark1.classList.add("tick_mark1");
        loaded ? tickMark1.textContent = "✓" : tickMark1.textContent = "⏱";
        var tickMark2 = document.createElement("p");
        tickMark2.classList.add("tick_mark2");
        loaded ? data.seen ? tickMark2.textContent = "✓" : tickMark2.textContent = "" : tickMark2.textContent = ""// ✓

        const tickMarksContainer = document.createElement("div");
        tickMarksContainer.classList.add("tick_marks_container");
        tickMarksContainer.appendChild(tickMark1);
        tickMarksContainer.appendChild(tickMark2);

        timeAndTickMarksContainer.appendChild(tickMarksContainer);
        msgBox.appendChild(timeAndTickMarksContainer);
    } else {
        msgBox.appendChild(timeP_element);
    }

    const msgBoxOuterContainer = document.createElement("div");
    type == "send" ? msgBoxOuterContainer.classList.add("send_msg_box_outer_container") : msgBoxOuterContainer.classList.add("received_msg_box_outer_container")

    msgBoxOuterContainer.appendChild(msgBox);

    return {
        msgBoxOuterContainer, 
        tickMark1, 
        tickMark2
    };
}

const receiveMessage = (msg) => {

    const {msgBoxOuterContainer} = getMsgBox(
        "received",
        {
            msg: msg,
            sender_time: new Date()
        }
    );

    const chat_box = chatBoxRef.current;
    chat_box.appendChild(msgBoxOuterContainer);
    chat_box.scrollTop = chat_box.scrollHeight;
}

const sendMessage = (e, socket, query) => {
    e.preventDefault();

    let msgBoxComponents = {};
    let msg = inputRef.current.value.trim()
    if (msg !== "") {
        msg = msg.split('').join('\u00AD');
        socket.emit('send_message', {
            to: query.get('to'),
            from: query.get('from'),
            message: msg,
            time: new Date()
        }, (serverAck) => {
            console.log('Server acknowledged:', serverAck);
            msgBoxComponents.tickMark1.textContent = "✓";
        });

        msgBoxComponents = getMsgBox(
            "send", 
            {
                msg: msg,
                sender_time: new Date()
            }
        );
        unseenMessages.push(msgBoxComponents.tickMark2);

        const chat_box = chatBoxRef.current;
        inputRef.current.value = "";
        inputRef.current.style.height = "auto";
        chat_box.appendChild(msgBoxComponents.msgBoxOuterContainer);
        chat_box.scrollTop = chat_box.scrollHeight;   
    } else {
        inputRef.current.value = "";
        return;
    }
}

function ChatBox({
    closeChat,
    imgUrl = null,
    name = null
}) {

    receiv = name;

    const query = useQuery();

    let socket = null

    inputRef = useRef();
    chatBoxRef = useRef();
    const typingRef = useRef();
    const loaderContainerRef = useRef();
    const inputFormRef = useRef();

    useEffect(() => {

        (async () => { 
            roomId = query.get('from')

            console.log("Room ID:", roomId);

            loaderContainerRef.current.style.display = "flex";
            inputRef.current.style.maxHeight = chatBoxRef.current.getBoundingClientRect().height/3 + "px";

            inputRef.current.addEventListener('input', (e) => {
                if (inputRef.current.value.trim() !== "") {
                    inputRef.current.style.height = "auto"; // reset height
                    inputRef.current.style.height = inputRef.current.scrollHeight - parseInt(getComputedStyle(inputRef.current).paddingLeft) - parseInt(getComputedStyle(inputRef.current).paddingRight) + "px"; // set new height
                    
                    socket.emit('is_typing', {
                        to: query.get('to'),
                        from: query.get('from'),
                        message: true
                    });
                } else {
                    inputRef.current.value = "";
                    inputRef.current.style.height = "auto";
                    socket.emit('is_typing', {
                        to: query.get('to'),
                        from: query.get('from'),
                        message: false
                    });
                }
            });

            inputRef.current.addEventListener('blur', () => {
                socket.emit('is_typing', {
                    to: query.get('to'),
                    from: query.get('from'),
                    message: false
                });
                // typingRef.current.textContent = "";
            });

            inputRef.current.addEventListener('focus', () => {
                if (inputRef.current.value.trim() !== "") {
                    socket.emit('is_typing', {
                        to: query.get('to'),
                        from: query.get('from'),
                        message: true
                    });
                } else {
                    socket.emit('is_typing', {
                        to: query.get('to'),
                        from: query.get('from'),
                        message: false
                    });
                }
                // inputRef.current.value.trim() !== "" ? typingRef.current.textContent = "typing..." : typingRef.current.textContent = ""
            });

            socket = io("http://localhost:3000", {
                reconnection: true,
                reconnectionDelay: 2000,
            });

            // roomId = getCookie("username") ? getCookie("username") : query.get('from');

            socket.emit('join_room', {
                roomId: roomId
            }, (ack) => {
                console.log(ack);
                socket.emit('retrieve_new_messages', {
                    receiver: query.get('from'),
                    sender: query.get('to') ? query.get('to') : receiv
                })
            });

            socket.io.on("error", (err) => {
                console.error("❌ Connection error:", err);
            });

            socket.io.on("connect_error", (err) => {
                console.error("❌ Failed to connect:", err.message);

                // Optional: Show user-friendly message
                alert("Server is unreachable. Please try again later.");
            });

            socket.io.on("reconnect_failed", () => {
                console.error("❌ Reconnection failed after max attempts");
            });

            socket.on('receive_message', (data, sendAck) => {
                console.log(`From ${data.from}: ${data.message}`);
                sendAck('Client received: ' +  data.message);
                receiveMessage(data.message);
            });

            socket.on('msg_seen_ack', (data) => {
                console.log(`ACK ${data.from}: ${data.message}`);
                unseenMessages = unseenMessages.filter(element => {
                    element.textContent = "✓";
                    return false;
                });
            });

            socket.on('is_typing', (data) => {
                data.message ? typingRef.current.textContent = "typing..." : typingRef.current.textContent = ""
            })

            socket.on("disconnect", (reason) => {
                console.warn("⚠️ Disconnected from server:", reason);

                if (reason === "ping timeout" || reason === "transport close") {
                    // Likely due to network loss
                    // alert("offline")
                }
            });

            socket.io.on("reconnect", (attempt) => {
                console.log(`🔄 Reconnected to server after ${attempt} tries`);
                socket.emit('join_room', {
                    roomId: roomId
                }, (ack) => {    
                    console.log('Joined room ack:', ack);
                });
            });

            socket.io.on("reconnect_failed", () => {
                console.error("❌ Reconnection failed after all attempts");
            });

            // socket.on("new_messages", (data) => {
            //     const chat_box = chatBoxRef.current;
            //     if (!chat_box.childNodes[1]) {
            //         console.log("new_messages", data);
            //         data.map((element, index) => {
            //             const {msgBoxOuterContainer, tickMark2} = getMsgBox(
            //                 element.sender == query.get('from') ? "send" : "received", 
            //                 element, 
            //                 true
            //             );
            //             if (!element.seen) {
            //                 unseenMessages.push(tickMark2);
            //             }
            //             // inputRef.current.value = "";
            //             chat_box.insertBefore(msgBoxOuterContainer, chat_box.childNodes[1]);
            //         });
            //     }
            //     loaderContainerRef.current.style.display = "none";
            //     chat_box.scrollTop = chat_box.scrollHeight;
            // });

            return () => {
                socket.disconnect();
            };
        })()

    }, []);
    
    return (
        <div
            id="chat_box_main_container"
        >
            <div
                id="profile_box_forsted_glass"
            >
            </div>
            <div 
                id="profile_box"
            >
                <div
                    id="name_and_profile"
                >
                    <div
                        id="profile"
                    >
                        <img id="profile-image" src={imgUrl ? imgUrl : "https://t4.ftcdn.net/jpg/03/64/21/11/360_F_364211147_1qgLVxv1Tcq0Ohz3FawUfrtONzz8nq3e.jpg"} height="100%" width="100%" />
                    </div>
                    <p 
                        id="profile_name"
                    >
                        {name ? name : query.get('to')}
                    </p>
                </div>
                <p
                    ref={typingRef}
                    id="typing"
                >
                </p>
                <button 
                    onClick={closeChat}
                >
                    X
                </button>
            </div>
            <div
                ref={chatBoxRef} 
                id="chat_box"
            >
                <div
                    ref={loaderContainerRef}
                    id="loader_container"
                    style={{
                        marginTop: "10px",
                        width: "100%",
                        height: "auto",
                        display: "none",
                        justifyContent: "center",
                        paddingBottom: "10px"
                    }}
                >
                    {/* <div
                        id="loader"
                        style={{
                            width: "30px",
                            height: "30px",
                            border: "5px solid lightgray",
                            borderTop: "5px solid #3498db",
                            borderRadius: "100%",
                            animation: "spin 0.7s linear infinite"
                        }}
                    >
                    </div> */}
                </div>
            </div>
            <form
                ref={inputFormRef}
                onSubmit={(e) => sendMessage(e, socket, query)}
                id="input_form"
            >
                <textarea
                    ref={inputRef}
                    name="msg" 
                    type="text" 
                    placeholder="Enter your message"
                    autoComplete="off"
                    rows={1}
                    required
                />
                <button
                    type="submit"
                >
                    <img src="/send_button.png" alt="Send" />
                </button>
            </form>
            <div
                id="input_form_forsted_glass"
            >
            </div>
        </div>
    )

}

export default ChatBox