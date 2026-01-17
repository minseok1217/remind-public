package com.example.remind.core.ui.component

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.example.remind.core.ui.theme.RemindGrayBg
import com.example.remind.core.ui.theme.RemindGreen
import com.example.remind.core.ui.theme.RemindTextGray

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RemindTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholderText: String,
    modifier: Modifier = Modifier,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingIcon: @Composable (() -> Unit)? = null
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = {
            Text(
                text = placeholderText,
                color = RemindTextGray,
                style = MaterialTheme.typography.bodyMedium
            )
        },
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp),
        shape = RoundedCornerShape(12.dp),

        // [수정된 부분] 최신 Material3 방식 적용
        colors = OutlinedTextFieldDefaults.colors(
            // 배경색 (포커스 있든 없든 회색)
            focusedContainerColor = RemindGrayBg,
            unfocusedContainerColor = RemindGrayBg,
            disabledContainerColor = RemindGrayBg,

            // 테두리 색상
            focusedBorderColor = RemindGreen,       // 포커스 되면 초록색
            unfocusedBorderColor = Color.Transparent, // 평소엔 투명

            // 텍스트 및 커서 색상
            focusedTextColor = Color.Black,
            unfocusedTextColor = Color.Black,
            cursorColor = RemindGreen
        ),
        keyboardOptions = keyboardOptions,
        visualTransformation = visualTransformation,
        trailingIcon = trailingIcon,
        singleLine = true
    )
}