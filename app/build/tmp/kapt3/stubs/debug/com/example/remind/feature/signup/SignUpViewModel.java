package com.example.remind.feature.signup;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000@\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u000e\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\b\u0007\u0018\u00002\u00020\u0001B\u0005\u00a2\u0006\u0002\u0010\u0002J\u000e\u0010\n\u001a\u00020\u000b2\u0006\u0010\f\u001a\u00020\rJ\u000e\u0010\u000e\u001a\u00020\u000b2\u0006\u0010\u000f\u001a\u00020\u0010J\u000e\u0010\u0011\u001a\u00020\u000b2\u0006\u0010\u0012\u001a\u00020\u0010J\u000e\u0010\u0013\u001a\u00020\u000b2\u0006\u0010\u0014\u001a\u00020\u0010J\u000e\u0010\u0015\u001a\u00020\u000b2\u0006\u0010\u0016\u001a\u00020\u0010J\u000e\u0010\u0017\u001a\u00020\u000b2\u0006\u0010\u0018\u001a\u00020\u0010J\u000e\u0010\u0019\u001a\u00020\u000b2\u0006\u0010\u000f\u001a\u00020\u0010J\u000e\u0010\u001a\u001a\u00020\u000b2\u0006\u0010\u0012\u001a\u00020\u0010J\u000e\u0010\u001b\u001a\u00020\u000b2\u0006\u0010\u0014\u001a\u00020\u0010J\u000e\u0010\u001c\u001a\u00020\u000b2\u0006\u0010\u0016\u001a\u00020\u0010J(\u0010\u001d\u001a\u00020\u000b2\f\u0010\u001e\u001a\b\u0012\u0004\u0012\u00020\u000b0\u001f2\u0012\u0010 \u001a\u000e\u0012\u0004\u0012\u00020\u0010\u0012\u0004\u0012\u00020\u000b0!R\u0014\u0010\u0003\u001a\b\u0012\u0004\u0012\u00020\u00050\u0004X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0017\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\u00050\u0007\u00a2\u0006\b\n\u0000\u001a\u0004\b\b\u0010\t\u00a8\u0006\""}, d2 = {"Lcom/example/remind/feature/signup/SignUpViewModel;", "Landroidx/lifecycle/ViewModel;", "()V", "_state", "Lkotlinx/coroutines/flow/MutableStateFlow;", "Lcom/example/remind/feature/signup/SignUpState;", "state", "Lkotlinx/coroutines/flow/StateFlow;", "getState", "()Lkotlinx/coroutines/flow/StateFlow;", "onAgreedChange", "", "agreed", "", "onParentIdChange", "id", "", "onParentNameChange", "name", "onParentPhoneChange", "phone", "onParentPwChange", "pw", "onPatientBirthChange", "birth", "onPatientIdChange", "onPatientNameChange", "onPatientPhoneChange", "onPatientPwChange", "onSignUpClick", "onSuccess", "Lkotlin/Function0;", "onError", "Lkotlin/Function1;", "app_debug"})
public final class SignUpViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<com.example.remind.feature.signup.SignUpState> _state = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<com.example.remind.feature.signup.SignUpState> state = null;
    
    public SignUpViewModel() {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<com.example.remind.feature.signup.SignUpState> getState() {
        return null;
    }
    
    public final void onParentNameChange(@org.jetbrains.annotations.NotNull()
    java.lang.String name) {
    }
    
    public final void onParentPhoneChange(@org.jetbrains.annotations.NotNull()
    java.lang.String phone) {
    }
    
    public final void onParentIdChange(@org.jetbrains.annotations.NotNull()
    java.lang.String id) {
    }
    
    public final void onParentPwChange(@org.jetbrains.annotations.NotNull()
    java.lang.String pw) {
    }
    
    public final void onPatientNameChange(@org.jetbrains.annotations.NotNull()
    java.lang.String name) {
    }
    
    public final void onPatientBirthChange(@org.jetbrains.annotations.NotNull()
    java.lang.String birth) {
    }
    
    public final void onPatientIdChange(@org.jetbrains.annotations.NotNull()
    java.lang.String id) {
    }
    
    public final void onPatientPwChange(@org.jetbrains.annotations.NotNull()
    java.lang.String pw) {
    }
    
    public final void onPatientPhoneChange(@org.jetbrains.annotations.NotNull()
    java.lang.String phone) {
    }
    
    public final void onAgreedChange(boolean agreed) {
    }
    
    public final void onSignUpClick(@org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onSuccess, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onError) {
    }
}