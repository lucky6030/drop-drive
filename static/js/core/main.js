async function main()
{
  if(await Rest_API.redirect_If_Not_Login()) return
  await update_Greeting_Message()
  await update_Owned_File_Names()
}

/** 환영 인사관련 UI를 업데이트시킴 */
async function update_Greeting_Message()
{
  const USER_EMAIL = await Rest_API.user_Email()
  document.querySelector("#greeting").innerText = `Hello, ${USER_EMAIL}!`
}

/** 현재 유저가 소유하고 있는 파일 목록관련 UI를 업데이트시킴 */ 
async function update_Owned_File_Names()
{
  try {
    
    const FILE_NAMES = await Rest_API.owned_File_Names()
    if(FILE_NAMES.length == 0) return
    
    const OWNED_FILE_TABLE_SEL = document.querySelector("#owned_file_table")
    const FILE_NAME_HTMLS = FILE_NAMES.map((file_name) => `<tr><td><div>${file_name}</div></td></tr>`)
    OWNED_FILE_TABLE_SEL.innerHTML = FILE_NAME_HTMLS.join("\n")
    
  } catch(e) {
    alert(e)
  }
}

document.querySelector("#add_file_form").onsubmit = async (e) => {
    e.preventDefault()
  
    const INPUT_FILE_SEL = document.querySelector("#add_file_form input[type='file']")
    if(INPUT_FILE_SEL.files.length == 0)
    {
      alert("Please select a file to upload")
      return
    }

    try {
      
      const UPLOADED_FILE_NAME = await Rest_API.upload_File_Object(INPUT_FILE_SEL.files[0])
      alert(`The requested file '${UPLOADED_FILE_NAME}' was successfully uploaded !`)
      await update_Owned_File_Names()

    } catch(e) {
      alert(e)
    }
}

main()