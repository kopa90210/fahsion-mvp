import { NextResponse } from 'next/server'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'

function sanitizeFileName(name: string) {
  return name.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are supported.' }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'dev-uploads')
    await mkdir(uploadDir, { recursive: true })

    const extension = path.extname(file.name) || `.${file.type.split('/')[1] ?? 'jpg'}`
    const baseName = sanitizeFileName(path.basename(file.name, path.extname(file.name))) || 'upload'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${timestamp}-${baseName}${extension.toLowerCase()}`
    const targetPath = path.join(uploadDir, fileName)

    const bytes = await file.arrayBuffer()
    await writeFile(targetPath, Buffer.from(bytes))

    return NextResponse.json({
      ok: true,
      path: `/dev-uploads/${fileName}`,
      name: fileName,
    })
  } catch (error) {
    console.error('dev-upload failed:', error)
    return NextResponse.json(
      { error: 'Could not save the uploaded file.' },
      { status: 500 },
    )
  }
}
