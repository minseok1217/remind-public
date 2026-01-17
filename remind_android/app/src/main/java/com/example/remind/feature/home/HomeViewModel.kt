package com.example.remind.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.database.FirebaseDatabase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class HomeViewModel : ViewModel() {
    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state

    init {
        fetchUserData()
    }

    private fun fetchUserData() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }

            // Firebase Realtime Database에서 "users/user_id" 경로의 데이터를 가져온다고 가정
            val database = FirebaseDatabase.getInstance().getReference("users/test_user")

            database.get().addOnSuccessListener { snapshot ->
                val name = snapshot.child("name").value.toString()
                val score = snapshot.child("totalScore").value.toString().toIntOrNull() ?: 0

                _state.update { it.copy(
                    userName = name,
                    totalScore = score,
                    languageScore = 0.75f, // 실제로는 snapshot에서 계산된 값 입력
                    isLoading = false
                ) }
            }.addOnFailureListener {
                _state.update { it.copy(isLoading = false) }
            }
        }
    }
}