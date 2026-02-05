package com.example.remind.feature.signup;

@kotlin.Metadata(mv = {1, 9, 0}, k = 2, xi = 48, d1 = {"\u0000.\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0006\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000b\n\u0000\u001a,\u0010\u0007\u001a\u00020\b2\u0006\u0010\t\u001a\u00020\n2\u0006\u0010\u000b\u001a\u00020\n2\u0012\u0010\f\u001a\u000e\u0012\u0004\u0012\u00020\n\u0012\u0004\u0012\u00020\b0\rH\u0007\u001a\b\u0010\u000e\u001a\u00020\bH\u0007\u001a\u0010\u0010\u000f\u001a\u00020\b2\u0006\u0010\u0010\u001a\u00020\u0011H\u0007\u001a6\u0010\u0012\u001a\u00020\b2\u0006\u0010\u000b\u001a\u00020\n2\u0012\u0010\f\u001a\u000e\u0012\u0004\u0012\u00020\n\u0012\u0004\u0012\u00020\b0\r2\u0006\u0010\t\u001a\u00020\n2\b\b\u0002\u0010\u0013\u001a\u00020\u0014H\u0007\"\u0013\u0010\u0000\u001a\u00020\u0001\u00a2\u0006\n\n\u0002\u0010\u0004\u001a\u0004\b\u0002\u0010\u0003\"\u0013\u0010\u0005\u001a\u00020\u0001\u00a2\u0006\n\n\u0002\u0010\u0004\u001a\u0004\b\u0006\u0010\u0003\u00a8\u0006\u0015"}, d2 = {"MainGreen", "Landroidx/compose/ui/graphics/Color;", "getMainGreen", "()J", "J", "TextFieldGray", "getTextFieldGray", "PatientInputRow", "", "label", "", "value", "onValueChange", "Lkotlin/Function1;", "SignUpPreview", "SignUpScreen", "navController", "Landroidx/navigation/NavHostController;", "SignUpTextField", "isPassword", "", "app_debug"})
public final class SignUpScreenKt {
    private static final long MainGreen = 0L;
    private static final long TextFieldGray = 0L;
    
    public static final long getMainGreen() {
        return 0L;
    }
    
    public static final long getTextFieldGray() {
        return 0L;
    }
    
    @kotlin.OptIn(markerClass = {androidx.compose.material3.ExperimentalMaterial3Api.class})
    @androidx.compose.runtime.Composable()
    public static final void SignUpScreen(@org.jetbrains.annotations.NotNull()
    androidx.navigation.NavHostController navController) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void SignUpTextField(@org.jetbrains.annotations.NotNull()
    java.lang.String value, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onValueChange, @org.jetbrains.annotations.NotNull()
    java.lang.String label, boolean isPassword) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void PatientInputRow(@org.jetbrains.annotations.NotNull()
    java.lang.String label, @org.jetbrains.annotations.NotNull()
    java.lang.String value, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onValueChange) {
    }
    
    @androidx.compose.ui.tooling.preview.Preview(showBackground = true)
    @androidx.compose.runtime.Composable()
    public static final void SignUpPreview() {
    }
}