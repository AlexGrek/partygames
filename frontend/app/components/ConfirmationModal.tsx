import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmationModalProps {
    isVisible: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isVisible,
    onConfirm,
    onCancel,
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "OK",
    cancelText = "Cancel"
}) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm"
                    onClick={onCancel}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                            duration: 0.2
                        }}
                        className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 min-w-80 max-w-md mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 pt-6 pb-4">
                            <h3 className="text-white text-lg font-semibold leading-tight">
                                {title}
                            </h3>
                            <p className="text-gray-300 text-sm mt-2 leading-relaxed">
                                {message}
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                id='cancel-modal-btn'
                                onClick={onCancel}
                                className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                            >
                                {cancelText}
                            </button>
                            <button
                                id='confirm-modal-btn'
                                onClick={onConfirm}
                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                            >
                                {confirmText}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};


// <ConfirmationModal
//     isVisible={isModalVisible}
//     onConfirm={handleConfirm}
//     onCancel={handleCancel}
//     title="Delete Item"
//     message="This action cannot be undone. Are you sure you want to delete this item?"
//     confirmText="Delete"
//     cancelText="Cancel"
// />

export default ConfirmationModal;